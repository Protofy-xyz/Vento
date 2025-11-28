import { API, getLogger } from 'protobase';
import { getDeviceToken, getServiceToken } from 'protonode';

const logger = getLogger();

const slugify = (value?: string) =>
  (value || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeEndpoint = (topic: string, deviceName: string) => {
  if (!topic) return null;
  const cleaned = topic.replace(/^\/+/, '');
  const withDevicesPrefix = `devices/${deviceName}/`;
  if (cleaned.startsWith(withDevicesPrefix)) {
    return '/' + cleaned.slice(withDevicesPrefix.length);
  }
  const withDeviceOnly = `${deviceName}/`;
  if (cleaned.startsWith(withDeviceOnly)) {
    return '/' + cleaned.slice(withDeviceOnly.length);
  }
  return '/' + cleaned;
};

const upsertBy = (list: any[], matcher: (item: any) => boolean, value: any) => {
  const idx = list.findIndex(matcher);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...value };
    return false;
  }
  list.push(value);
  return true;
};

export default (_app, context) => {
  const discoveryPrefix = process.env.ESPHOME_DISCOVERY_PREFIX || 'homeassistant';
  const { mqtt, topicSub } = context;

  type PendingEntry = {
    data: any;
    timer?: ReturnType<typeof setTimeout> | null;
  };
  const pending: Record<string, PendingEntry> = {};
  const pendingDebounceMs = Number(process.env.ESPHOME_DISCOVERY_DEBOUNCE_MS ?? '5000');

  const scheduleRegisterActions = (() => {
    const debounceMs = Number(process.env.ESPHOME_REGISTER_ACTIONS_DEBOUNCE_MS ?? '3000');
    let timer: ReturnType<typeof setTimeout> | null = null;
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(async () => {
        timer = null;
        try {
          await API.get(`/api/core/v1/devices/registerActions?token=${getServiceToken()}`);
        } catch (err) {
          logger.error({ err }, 'Failed to trigger registerActions after ESPHome discovery');
        }
      }, debounceMs);
    };
  })();

  const mergeSubsystems = (base: any[], incoming: any[]) => {
    const result = [...(base || [])];
    for (const sub of incoming || []) {
      const idx = result.findIndex((s) => s.name === sub.name);
      if (idx === -1) {
        result.push(sub);
        continue;
      }
      const existing = result[idx];
      existing.type = existing.type || sub.type;
      existing.monitors = existing.monitors || [];
      existing.actions = existing.actions || [];
      for (const mon of sub.monitors || []) {
        upsertBy(
          existing.monitors,
          (m) => m.endpoint === mon.endpoint || m.name === mon.name,
          mon
        );
      }
      for (const act of sub.actions || []) {
        upsertBy(
          existing.actions,
          (a) => a.endpoint === act.endpoint || a.name === act.name,
          act
        );
      }
      result[idx] = existing;
    }
    return result;
  };

  const flushDevice = async (deviceName: string) => {
    const entry = pending[deviceName];
    if (!entry) return;
    entry.timer = null;
    const pendingData = entry.data;
    const token = getServiceToken();

    let deviceData: any = null;
    let existed = true;
    try {
      const resp = await API.get(`/api/core/v1/devices/${encodeURIComponent(deviceName)}?token=${token}`);
      if (!resp.isError) {
        deviceData = resp.data;
      } else {
        const status = resp?.status ?? resp?.error?.response?.status;
        const notFound = status === 404 || resp?.error?.result === 'not found';
        if (notFound) {
          existed = false;
        } else {
          logger.error({ deviceName, error: resp.error }, 'Failed to fetch device before ESPHome upsert');
          return;
        }
      }
    } catch {
      existed = false;
    }

    if (!deviceData) {
      deviceData = {
        name: deviceName,
        currentSdk: 'esphome',
        subsystem: [],
        credentials: { mqtt: { username: deviceName, password: getDeviceToken(deviceName, false) } },
        data: {},
      };
    }

    deviceData.credentials = deviceData.credentials || pendingData.credentials;
    deviceData.data = {
      ...(deviceData.data || {}),
      ...(pendingData.data || {}),
    };
    const hasDefinition = !!deviceData.deviceDefinition;
    if (!hasDefinition) {
      deviceData.subsystem = mergeSubsystems(deviceData.subsystem || [], pendingData.subsystem || []);
    } else {
      logger.debug({ deviceName }, 'Skipping subsystem merge (device has definition)');
    }

    try {
      if (!existed) {
        const createPayload = {
          name: deviceName,
          currentSdk: 'esphome',
          credentials: deviceData.credentials,
          data: deviceData.data,
        };
        await API.post(`/api/core/v1/devices?token=${token}`, createPayload);
        logger.info({ deviceName }, 'Created new ESPHome device from discovery');
      }

      await API.post(`/api/core/v1/devices/${encodeURIComponent(deviceName)}?token=${token}`, deviceData);
      logger.info({ deviceName, existed, subsystems: deviceData.subsystem?.length }, 'Updated device from ESPHome discovery');
    } catch (err) {
      logger.error({ err, deviceName }, 'Failed to persist ESPHome discovered device');
      return;
    }

    if (!deviceData.deviceDefinition) {
      scheduleRegisterActions();
    } else {
      logger.debug({ deviceName }, 'Skipping registerActions (device has definition)');
    }
    delete pending[deviceName];
  };

  const upsertDeviceFromDiscovery = async (message: string, topic: string) => {
    if (!topic.startsWith(`${discoveryPrefix}/`) || !topic.endsWith('/config')) {
      return;
    }
    let payload: any;
    try {
      payload = JSON.parse(message);
    } catch {
      return;
    }
    if (!payload || typeof payload !== 'object') return;

    const parts = topic.split('/');
    if (parts.length < 4) return;
    const component = parts[1] || 'esphome';
    const nodeId = parts[2];
    const objectId = parts[3];
    const deviceInfo = payload.device || payload.dev || {};
    const deviceName =
      slugify(
        deviceInfo.name ||
          (Array.isArray(deviceInfo.identifiers) ? deviceInfo.identifiers[0] : '') ||
          (Array.isArray(deviceInfo.ids) ? deviceInfo.ids[0] : deviceInfo.ids) ||
          nodeId
      ) || slugify(nodeId);
    if (!deviceName) return;

    const monitorName =
      slugify(payload.object_id || payload.obj_id || payload.uniq_id || objectId || payload.name) ||
      slugify(`${component}_${objectId || 'entity'}`);
    const stateEndpoint = payload.state_topic
      ? normalizeEndpoint(payload.state_topic, deviceName)
      : payload.stat_t
        ? normalizeEndpoint(payload.stat_t, deviceName)
        : null;
    const commandEndpoint = payload.command_topic
      ? normalizeEndpoint(payload.command_topic, deviceName)
      : payload.cmd_t
        ? normalizeEndpoint(payload.cmd_t, deviceName)
        : null;
    if (!stateEndpoint && !commandEndpoint) return;

    const subsystemName = slugify(component) || 'esphome';

    const baseEntry: PendingEntry =
      pending[deviceName] ||
      {
        data: {
          name: deviceName,
          currentSdk: 'esphome',
          subsystem: [],
          credentials: { mqtt: { username: deviceName, password: getDeviceToken(deviceName, false) } },
          data: {},
        },
        timer: null,
      };

    const subsystem = {
      name: subsystemName,
      type: 'esphome',
      monitors: [] as any[],
      actions: [] as any[],
    };

    if (stateEndpoint) {
      subsystem.monitors.push({
        name: monitorName,
        label: payload.name || monitorName,
        description: payload.device_class || payload.state_class || component,
        units: payload.unit_of_measurement ?? payload.unit ?? '',
        endpoint: stateEndpoint,
        connectionType: 'mqtt',
      });
    }
    if (commandEndpoint) {
      subsystem.actions.push({
        name: monitorName,
        label: payload.name || monitorName,
        description: payload.device_class
          ? `Command for ${payload.device_class}`
          : `Command for ${payload.name || monitorName}`,
        endpoint: commandEndpoint,
        connectionType: 'mqtt',
        payload: { type: 'string' },
      });
    }

    baseEntry.data.subsystem = mergeSubsystems(baseEntry.data.subsystem, [subsystem]);
    if (deviceInfo && Object.keys(deviceInfo).length) {
      baseEntry.data.data = {
        ...(baseEntry.data.data || {}),
        esphome: {
          ...(baseEntry.data.data?.esphome || {}),
          device: deviceInfo,
        },
      };
    }

    if (baseEntry.timer) {
      clearTimeout(baseEntry.timer);
    }
    baseEntry.timer = setTimeout(
      () => flushDevice(deviceName).catch((err) => logger.error({ err }, 'Flush failed')),
      pendingDebounceMs
    );
    logger.debug(
      {
        deviceName,
        subsystem: subsystemName,
        monitors: subsystem.monitors.length,
        actions: subsystem.actions.length,
        debounceMs: pendingDebounceMs,
      },
      'Queued ESPHome discovery payload'
    );
    pending[deviceName] = baseEntry;
  };

  topicSub(mqtt, `${discoveryPrefix}/#`, (message, topic) => {
    upsertDeviceFromDiscovery(message, topic).catch((err) =>
      logger.error({ err, topic }, 'Error handling ESPHome discovery message')
    );
  });
};

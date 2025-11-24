import {CronJob} from 'cron'
import {getLogger } from 'protobase';

export const createPeriodicSchedule = (hours, minutes, callb, days) => {
    const logger = getLogger()
    const cronExpr = parseCronExpression(minutes, hours, days)
    new CronJob(
        cronExpr, // cronTime
        async () => {
            await callb()
            logger.info('Executed periodic schedule');
        }, // onTick
        null, // onComplete
        true, // start
    );
    logger.info('Periodic schedule: '+hours+':'+minutes+' on '+days)
}

export const scheduleJob = ({
    croneTime,
    hours,
    minutes,
    callback,
    days,
    name = 'periodic-job',
    autoStart = true,
    runOnInit = false
}) => {
    const logger = getLogger();

    if (!croneTime) {
        if (typeof hours !== 'number' || hours < 0 || hours > 23) {
            throw new RangeError(`Invalid "hours" value: ${hours}`);
        }

        if (typeof minutes !== 'number' || minutes < 0 || minutes > 59) {
            throw new RangeError(`Invalid "minutes" value: ${minutes}`);
        }
    }

    if (typeof callback !== 'function') {
        throw new TypeError('"callback" must be a function');
    }

    const cronExpr = croneTime ?? parseCronExpression(minutes, hours, days);

    const callbackWrapped = async () => {
         const startedAt = Date.now();
            try {
                await callback();
                const elapsedMs = Date.now() - startedAt;
                logger.info(
                    `[${name}] Executed periodic schedule in ${elapsedMs}ms`
                );
            } catch (err) {
                logger.error(
                    `[${name}] Error executing periodic schedule: ${err?.message || err}`
                );
                logger.debug?.(err); // por si tu logger soporta debug/stack
            }
    }

    const job = new CronJob(
        cronExpr,
        callbackWrapped,
        null,      // onComplete
        false      // start (lo controlamos abajo con autoStart)
    );

    if (autoStart) {
        job.start();
    }

    if (runOnInit) {
        callbackWrapped();
    }

    logger.info(
        `[${name}] Scheduled at ${String(hours).padStart(2, '0')}:${String(
            minutes
        ).padStart(2, '0')} on ${JSON.stringify(days)} (${cronExpr})`
    );

    return job;
};

const parseCronExpression = (minutes, hours, days) => {
    console.log({
        hours,
        minutes,
        days
    })
    const daysHashmap = {
        "monday": 1,
        "tuesday": 2,
        "wednesday": 3,
        "thursday": 4,
        "friday": 5,
        "saturday": 6,
        "sunday": 7
    }

    let daysIndex = []
    days.split(',').forEach(item => {
        let day = item.trim()
        daysIndex.push(daysHashmap[day.toLowerCase()])
    })

    let cronExpr = '0 ' + minutes + ' ' + hours + ' * * ' + daysIndex.join(',')
    return cronExpr
}

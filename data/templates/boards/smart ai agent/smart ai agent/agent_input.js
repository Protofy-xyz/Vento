const callCore = () => {
  setTimeout(() => executeAction({name: "user_request", params: {}}), 1)
}

if (params.action == "reset") {
  return { items: [], current: undefined };
} else if (params.action == "skip") {
  if(board[name]?.items?.length) {
    callCore();
  }
  return {
    items: (Array.isArray(board[name]?.items) ? board[name].items : []).slice(
      1
    ),
    current: board[name].items[0],
  };
} else if (params.action == "remove") {
  const queue = Array.isArray(board[name]?.items) ? board[name].items : [];
  const index = parseInt(params.index, 10);
  return {
    items: queue.slice(0, index).concat(queue.slice(index + 1)),
    current: board[name]?.current,
  };
} else if (params.action == "clear") {
  return { items: [], current: board[name].current };
} else if (params.action == "reply") {
  //reply to current job
  const job = board[name].current;
  if (!job) {
    throw "Unable to send reply: There is not current job to reply to";
  }
  const res = context.boards.getVar("job_" + job.id, true);
  if (!res) {
    throw "Unable to send reply: Empty res object in current job.";
  }
  res.send(params.response);
  if(board[name]?.items?.length) {
    callCore();
  }
  return {
    items: (Array.isArray(board[name]?.items) ? board[name].items : []).slice(
      1
    ),
    current: board[name].items[0],
  };
} else {
  const genUID = (l = 16) => {
    const t = Date.now().toString(36);
    const r =
      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    let out = "";
    for (let i = 0; i < l; i++)
      out += (i % 2 ? t : r)[i % (i % 2 ? t.length : r.length)];
    return out;
  };
  const uid = genUID(16);
  context.boards.setVar("job_" + uid, res);
  const item = {
    id: uid,
    time: new Date().toISOString(),
    ua: req.get("User-Agent"),
    params: req.query,
    path: params.path,
  };

  if (board[name]?.current) {
    return {
      items: (Array.isArray(board[name]?.items)
        ? board[name].items
        : []
      ).concat([item]),
      current: board[name]?.current,
    };
  }
  callCore();
  return {
    items: Array.isArray(board[name]?.items) ? board[name].items : [],
    current: item,
  };
}

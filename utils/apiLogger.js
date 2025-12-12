// API Request/Response Logging Middleware
// Logs all incoming requests and outgoing responses for debugging

export default function apiLogger(req, res, next) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // Log incoming request
  console.log("🔵 API REQUEST:", {
    method: req.method,
    url: req.originalUrl || req.url,
    path: req.path,
    query: req.query,
    body: req.body,
    headers: {
      cookie: req.headers.cookie,
      "content-type": req.headers["content-type"],
      origin: req.headers.origin,
      referer: req.headers.referer,
    },
    sessionId: req.sessionID,
    timestamp,
  });

  // Capture original res.json to log responses
  const originalJson = res.json.bind(res);
  res.json = function (data) {
    const duration = Date.now() - startTime;
    console.log("🟢 API RESPONSE:", {
      status: res.statusCode,
      method: req.method,
      url: req.originalUrl || req.url,
      duration: `${duration}ms`,
      data: data,
      timestamp: new Date().toISOString(),
    });
    return originalJson(data);
  };

  // Capture original res.sendStatus to log status-only responses
  const originalSendStatus = res.sendStatus.bind(res);
  res.sendStatus = function (statusCode) {
    const duration = Date.now() - startTime;
    console.log("🟢 API RESPONSE:", {
      status: statusCode,
      method: req.method,
      url: req.originalUrl || req.url,
      duration: `${duration}ms`,
      data: null,
      timestamp: new Date().toISOString(),
    });
    return originalSendStatus(statusCode);
  };

  // Handle errors
  res.on("finish", () => {
    if (res.statusCode >= 400) {
      const duration = Date.now() - startTime;
      console.error("🔴 API ERROR RESPONSE:", {
        status: res.statusCode,
        method: req.method,
        url: req.originalUrl || req.url,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
    }
  });

  next();
}



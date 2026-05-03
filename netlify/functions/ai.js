const https = require("https");

exports.handler = async function (event, context) {
  // GET দিয়ে test করা যাবে
  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ok", message: "Substack AI function is running!" }),
    };
  }

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Method Not Allowed: received " + event.httpMethod }),
    };
  }

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!OPENROUTER_API_KEY) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "[Server] OPENROUTER_API_KEY environment variable সেট নেই। Netlify → Site config → Environment variables চেক করো।" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Invalid JSON body: " + e.message }),
    };
  }

  const { model, messages, max_tokens, temperature } = body;

  if (!model || !messages) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "model এবং messages দুটোই দরকার।" }),
    };
  }

  const postData = JSON.stringify({
    model,
    messages,
    max_tokens: max_tokens || 1400,
    temperature: temperature !== undefined ? temperature : 0.75,
  });

  const siteOrigin =
    event.headers["x-forwarded-host"]
      ? "https://" + event.headers["x-forwarded-host"]
      : (event.headers.origin || "https://your-site.netlify.app");

  const options = {
    hostname: "openrouter.ai",
    path: "/api/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": "Bearer " + OPENROUTER_API_KEY,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
      "HTTP-Referer": siteOrigin,
      "X-Title": "Substack Viral Generator",
    },
  };

  try {
    const result = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(raw) });
          } catch (e) {
            reject(new Error("[Parse Error] " + raw.slice(0, 400)));
          }
        });
      });
      req.on("error", (e) => reject(new Error("[Network Error] " + e.message)));
      req.write(postData);
      req.end();
    });

    if (result.status !== 200) {
      return {
        statusCode: result.status,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ error: "[OpenRouter " + result.status + "] " + (result.data?.error?.message || JSON.stringify(result.data)) }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify(result.data),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};

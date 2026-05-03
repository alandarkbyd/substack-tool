// Node.js built-in https ব্যবহার করছি — fetch-এর উপর নির্ভর নেই
const https = require("https");

exports.handler = async function (event, context) {
  // CORS preflight handle করো
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!OPENROUTER_API_KEY) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "OPENROUTER_API_KEY is not set in Netlify environment variables." }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const { model, messages, max_tokens, temperature } = body;

  if (!model || !messages) {
    return {
      statusCode: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "model and messages are required" }),
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
      : event.headers.origin || "https://your-site.netlify.app";

  const options = {
    hostname: "openrouter.ai",
    path: "/api/v1/chat/completions",
    method: "POST",
    headers: {
      Authorization: "Bearer " + OPENROUTER_API_KEY,
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
            const parsed = JSON.parse(raw);
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            reject(new Error("Failed to parse OpenRouter response: " + raw.slice(0, 300)));
          }
        });
      });
      req.on("error", (e) => reject(new Error("HTTPS request error: " + e.message)));
      req.write(postData);
      req.end();
    });

    if (result.status !== 200) {
      return {
        statusCode: result.status,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ error: result.data?.error?.message || "OpenRouter API error", detail: result.data }),
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
      body: JSON.stringify({ error: err.message || "Internal server error" }),
    };
  }
};

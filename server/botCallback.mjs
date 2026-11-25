import { clientAddress } from './visits.mjs';

const MAX_BODY = 1024 * 1024;

function readRawBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('body too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(decodeRequestBody(Buffer.concat(chunks))));
    request.on('error', reject);
  });
}

export function decodeRequestBody(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  }
  catch {
    return new TextDecoder('euc-kr').decode(buffer);
  }
}

function receivedCommand(payload, bodyText) {
  const content = payload?.content;
  if (content && typeof content.text === 'string') return content.text;
  if (typeof payload?.text === 'string') return payload.text;
  if (typeof payload?.command === 'string') return payload.command;
  return bodyText;
}

export function botCallbackReply(bodyText) {
  let payload = null;
  try {
    payload = JSON.parse(bodyText);
  }
  catch {
    payload = null;
  }
  if (payload && typeof payload === 'object' && typeof payload.challenge === 'string') {
    return { status: 200, body: { challenge: payload.challenge } };
  }
  return {
    status: 200,
    body: {
      ok: true,
      command: receivedCommand(payload, bodyText),
      received: payload ?? bodyText
    }
  };
}

export function formatBotCallbackLog({ receivedAt, address, headers, bodyText }) {
  return [
    `[bot] ${receivedAt} POST /bot from ${address}`,
    `[bot] headers ${JSON.stringify(headers ?? {})}`,
    `[bot] body ${bodyText}`
  ].join('\n');
}

export function handleBotCallback(request, response) {
  if (request.method !== 'POST') {
    response.statusCode = 405;
    response.setHeader('allow', 'POST');
    response.end();
    return Promise.resolve();
  }
  return readRawBody(request).then(bodyText => {
    const entry = formatBotCallbackLog({
      receivedAt: new Date().toISOString(),
      address: clientAddress(request),
      headers: request.headers,
      bodyText
    });
    console.log(entry);
    const reply = botCallbackReply(bodyText);
    response.statusCode = reply.status;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.setHeader('cache-control', 'no-store');
    response.end(JSON.stringify(reply.body));
  }).catch(error => {
    console.log(`[bot] ${new Date().toISOString()} POST /bot failed ${error instanceof Error ? error.message : 'read error'}`);
    if (response.writableEnded) return;
    response.statusCode = error instanceof Error && error.message === 'body too large' ? 413 : 400;
    response.end();
  });
}

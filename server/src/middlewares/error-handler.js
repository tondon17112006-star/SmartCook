import { HttpError } from '../utilities/http-error.js';

const messages = {
  400: 'Dữ liệu yêu cầu không hợp lệ.',
  403: 'Nguồn yêu cầu không được phép truy cập.',
  413: 'Dữ liệu yêu cầu vượt quá dung lượng cho phép.',
  500: 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.',
  503: 'Chưa kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.',
  504: 'Truy vấn cơ sở dữ liệu quá thời gian cho phép. Vui lòng thử lại sau.',
};

const connectionCodes = new Set([
  'ELOGIN', 'ESOCKET', 'ECONNCLOSED', 'ENOTOPEN', 'ENOCONN', 'EINSTLOOKUP',
  'DB_CONNECTION_FAILED',
]);

function sqlStates(error) {
  return [error, ...(Array.isArray(error.precedingErrors) ? error.precedingErrors : [])]
    .flatMap((item) => [item.state, item.originalError?.sqlstate])
    .filter((value) => typeof value === 'string');
}

export function errorHandler(error, _req, res, next) {
  if (res.headersSent) return next(error);

  let status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599
    ? error.status
    : 500;

  // Native ODBC timeouts use EREQUEST + HYT00, unlike Tedious's ETIMEOUT.
  const states = sqlStates(error);
  if (error.code === 'ETIMEOUT' || states.some((state) => ['HYT00', 'HYT01'].includes(state))) status = 504;
  else if (error.name === 'ConnectionError' || connectionCodes.has(error.code)
           || states.some((state) => /^08[A-Z0-9]{3}$/u.test(state))) status = 503;

  if (status >= 500) {
    // Driver errors can contain credentials or SQL. Log fixed fields only.
    const code = status === 504 ? 'DB_TIMEOUT'
      : status === 503 ? 'DB_CONNECTION_FAILED' : 'INTERNAL_ERROR';
    console.error('Yêu cầu API thất bại.', { status, code });
  }

  const message = error instanceof HttpError && status < 500
    ? error.message : messages[status] || messages[500];
  return res.status(status).json({ message });
}

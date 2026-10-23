export function getListenErrorMessage(error, host, port) {
  if (error.code === 'EADDRINUSE') {
    return `Không thể khởi động Backend: cổng ${port} trên ${host} đang được sử dụng.`;
  }

  if (error.code === 'EACCES') {
    return `Không thể khởi động Backend: không có quyền mở cổng ${port} trên ${host}.`;
  }

  return `Không thể khởi động Backend: ${error.message}`;
}

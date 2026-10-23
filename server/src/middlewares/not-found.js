export function notFound(_req, res) {
  res.status(404).json({ message: 'Không tìm thấy đường dẫn yêu cầu.' });
}

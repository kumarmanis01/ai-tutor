export function requireAdmin(session: any) {
  if (!session || !session.user || session.user.role !== 'admin') {
    const err: any = new Error('Forbidden: admin required')
    err.status = 403
    throw err
  }
  return true
}

export default requireAdmin

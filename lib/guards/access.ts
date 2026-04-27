export async function hasLearnerAccess(db: any, userId: string | null | undefined, courseId: string, tenantId?: string | null) {
  // If no active product (not monetized), allow access
  const prod = await db.product.findFirst({ where: { courseId, active: true } })
  if (!prod) return true

  // Require either a purchase or an enrollment
  if (!userId) return false

  // Check purchase that matches this product and confirm tenant if provided
  const purchase = await db.purchase.findFirst({ where: { userId, productId: prod.id }, include: { product: true } })
  if (purchase) {
    if (tenantId && String(purchase.product?.tenantId) !== String(tenantId)) return false
    return true
  }

  // Check enrollment; if tenantId present, ensure product tenant matches
  const enrollment = await db.enrollment.findFirst({ where: { userId, courseId } })
  if (enrollment) {
    if (tenantId && String(prod?.tenantId) !== String(tenantId)) return false
    return true
  }
  return false
}

export default hasLearnerAccess

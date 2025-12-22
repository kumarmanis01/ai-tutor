export async function hasLearnerAccess(db: any, userId: string | null | undefined, courseId: string) {
  // If no active product (not monetized), allow access
  const prod = await db.product.findFirst({ where: { courseId, active: true } })
  if (!prod) return true

  // Require either a purchase or an enrollment
  if (!userId) return false
  const purchase = await db.purchase.findFirst({ where: { userId, productId: prod.id } })
  if (purchase) return true
  const enrollment = await db.enrollment.findFirst({ where: { userId, courseId } })
  if (enrollment) return true
  return false
}

export default hasLearnerAccess

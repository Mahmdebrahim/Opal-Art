import { useState, useEffect, useMemo } from 'react'
import { Star } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { reviewService } from '../services/review.service'
import StarRating from '../../../components/Ui/StarRating'
import { SharedModal, ModalActions } from '../../../components/SharedModal'

export default function ReviewModal({
  orderId,
  artistId,
  isOpen,
  onClose,
  existingReview = null,
  onSuccess,
}) {
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const isEditing = !!existingReview?._id

  // ─── Initial Values (عشان نقارن لو فيه تغيير) ───
  const initialValues = useMemo(() => ({
    rating: existingReview?.rating || 5,
    comment: existingReview?.comment || '',
  }), [existingReview])

  // ─── Check if form has changes ───
  const hasChanges = useMemo(() => {
    if (!isEditing) return true // لو مش edit mode، دايماً فيه changes (بيعمل create)
    return rating !== initialValues.rating || comment !== initialValues.comment
  }, [rating, comment, initialValues, isEditing])

  // ─── Initialize form on open ───
  useEffect(() => {
    if (isOpen) {
      if (existingReview) {
        setRating(existingReview.rating || 5)
        setComment(existingReview.comment || '')
      } else {
        setRating(5)
        setComment('')
      }
      setErrorMsg('')
    }
  }, [existingReview, isOpen])

  // ─── Mutation ───
  const mutation = useMutation({
    mutationFn: async () => {
      if (isEditing) {
        return await reviewService.updateReview(existingReview._id, {
          rating,
          comment,
        })
      } else {
        return await reviewService.createReview({
          orderId,
          rating,
          comment,
        })
      }
    },
    onSuccess: async (data) => {
      // ✅ Toast واحد بس - حسب الحالة
      toast.success(
        isEditing ? 'تم تحديث تقييمك بنجاح ✅' : 'تم إرسال تقييمك بنجاح ✅',
      )

      queryClient.invalidateQueries({
        queryKey: ['myOrders'],
        refetchType: 'all',
      })

      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0]
          return (
            key === 'artist-reviews' ||
            key === 'my-reviews' ||
            key === 'artist' ||
            key === 'artists' ||
            key === 'order'
          )
        },
        refetchType: 'all',
      })

      if (onSuccess) onSuccess(data)
      onClose()
    },
    onError: (err) => {
      const msg =
        err?.response?.data?.message ||
        err.message ||
        'حدث خطأ أثناء حفظ التقييم'
      toast.error(msg)
      setErrorMsg(msg)
    },
  })

  const handleSubmit = () => {
    // ✅ منع double submission
    if (mutation.isPending) return

    setErrorMsg('')

    // ✅ لو مفيش تغيير، ما ترسلش
    if (!hasChanges) {
      setErrorMsg('لم تقم بأي تغيير على التقييم')
      return
    }

    if (!rating || rating < 1 || rating > 5) {
      setErrorMsg('يرجى اختيار التقييم بالنجوم (1 إلى 5)')
      return
    }

    const trimmed = comment.trim()
    if (trimmed.length > 0 && trimmed.length < 3) {
      setErrorMsg('التعليق يجب أن يكون 3 حروف على الأقل عند كتابته')
      return
    }
    if (trimmed.length > 500) {
      setErrorMsg('التعليق لا يمكن أن يتجاوز 500 حرف')
      return
    }

    mutation.mutate()
  }

  // ✅ Dynamic button label
  const submitLabel = useMemo(() => {
    if (mutation.isPending) return 'جاري الحفظ...'
    if (!isEditing) return 'إرسال التقييم'
    if (!hasChanges) return 'لا توجد تغييرات'
    return 'تحديث التقييم'
  }, [isEditing, hasChanges, mutation.isPending])

  return (
    <SharedModal
      open={isOpen}
      onClose={onClose}
      title={isEditing ? 'تعديل تقييم الفنان' : 'تقييم الفنان'}
      icon={Star}
      iconColor="text-amber-400"
      size="md"
    >
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-5">
        {/* Error Message */}
        {errorMsg && (
          <div className="p-3 text-xs font-body text-red-600 bg-red-50 border border-red-200">
            {errorMsg}
          </div>
        )}

        {/* Interactive Star Rating */}
        <div className="text-center py-2">
          <label className="block text-xs font-body font-semibold text-[var(--color-on-surface-variant)] mb-3">
            اختر التقييم (من 1 إلى 5 نجوم)
          </label>
          <div className="flex justify-center">
            <StarRating
              value={rating}
              onChange={(val) => setRating(val)}
              size="lg"
            />
          </div>
        </div>

        {/* Comment Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-body font-semibold text-[var(--color-on-surface-variant)]">
              تعليقك على التجربة (اختياري)
            </label>
            <span className="text-[11px] font-mono text-[var(--color-on-surface-variant)]">
              {comment.length}/500
            </span>
          </div>
          <textarea
            rows={4}
            maxLength={500}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="اكتب انطباعك ورأيك في اللوحة وتجربة الشراء من الفنان..."
            className="w-full p-3 text-xs font-body bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/60 focus:border-[var(--color-primary)] focus:outline-none transition-colors text-[var(--color-on-surface)] resize-none"
          />
        </div>

        {/* Actions */}
        <ModalActions
          onClose={onClose}
          onConfirm={handleSubmit}
          confirmLabel={submitLabel}
          confirmVariant="primary"
          isLoading={mutation.isPending}
          disabled={!hasChanges || mutation.isPending}
        />
      </form>
    </SharedModal>
  )
}
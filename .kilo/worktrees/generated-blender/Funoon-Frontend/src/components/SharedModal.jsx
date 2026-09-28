import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";

/**
 * مودال سريع وموحد - استخدمه في كل المودالات في المشروع
 * 
 * @param {boolean} open - هل المودال مفتوح
 * @param {function} onClose - دالة الإغلاق
 * @param {string} title - عنوان المودال
 * @param {ReactNode} icon - أيقونة (اختياري)
 * @param {string} iconColor - لون الأيقونة (اختياري)
 * @param {string} size - حجم المودال: "sm" | "md" | "lg" | "xl"
 * @param {ReactNode} children - محتوى المودال
 * @param {string} description - وصف اختياري تحت العنوان
 */
export function SharedModal({
    open,
    onClose,
    title,
    icon: Icon,
    iconColor,
    size = "md",
    children,
    description,
}) {
    const sizeClasses = {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-3xl",
    };

    return (
        <Dialog.Root  open={open} onOpenChange={(open) => !open && onClose()}>
            <AnimatePresence>
                {open && (
                    <Dialog.Portal>
                        {/* Overlay - سريع وبدون blur */}
                        <Dialog.Overlay asChild>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="fixed inset-0 z-50 bg-black/60 "
                            />
                        </Dialog.Overlay>

                        {/* Content */}
                        <Dialog.Content asChild>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                                transition={{ duration: 0.15, ease: "easeOut" }}
                                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            >
                                <div
                                    className={`bg-surface-container-lowest w-full ${sizeClasses[size]} border border-outline-variant/40 shadow-xl pointer-events-auto p-5 max-h-[85vh] overflow-y-auto`}
                                >
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <Dialog.Title className="font-display text-lg text-on-surface flex items-center gap-2">
                                            {Icon && <Icon className={`w-4 h-4 ${iconColor || ""}`} />}
                                            {title}
                                        </Dialog.Title>
                                        <Dialog.Close asChild>
                                            <button className="text-on-surface-variant hover:text-primary transition-colors">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </Dialog.Close>
                                    </div>

                                    {description && (
                                        <p className="text-sm text-on-surface-variant mb-4">
                                            {description}
                                        </p>
                                    )}

                                    {/* Body */}
                                    {children}
                                </div>
                            </motion.div>
                        </Dialog.Content>
                    </Dialog.Portal>
                )}
            </AnimatePresence>
        </Dialog.Root>
    );
}

/**
 * زرار موحد للإجراءات (موافقة/إلغاء)
 */
export function ModalActions({
    onClose,
    onConfirm,
    confirmLabel = "تأكيد",
    cancelLabel = "إلغاء",
    confirmVariant = "primary",
    isLoading = false,
    disabled = false,
}) {
    const variants = {
        primary: "bg-primary hover:opacity-90",
        danger: "bg-[var(--color-error)] hover:bg-[var(--color-error)]/90",
        success: "bg-emerald-600 hover:bg-emerald-700",
    };

    return (
        <div className="flex gap-3 mt-4">
            <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 py-2.5 text-sm font-semibold text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container-low transition-premium disabled:opacity-40"
            >
                {cancelLabel}
            </button>
            <button
                onClick={onConfirm}
                disabled={isLoading || disabled}
                className={`flex-1 py-2.5 text-sm font-semibold text-white transition-premium disabled:opacity-50 ${variants[confirmVariant]}`}
            >
                {isLoading ? (
                   <div className={`animate-spin mt-2 rounded-full h-4 w-4 border-b-2 mx-auto`} />
                ) : (
                    confirmLabel
                )}
            </button>
        </div>
    );
}
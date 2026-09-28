import { Link } from "react-router-dom";
import Button from "./Button";

export default function EmptyState({ icon: Icon, title, description, action, actionTo, actionLabel }) {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-[var(--color-surface)]">
            {Icon && (
                <div className="w-16 h-16 rounded-full bg-[var(--color-surface-container-low)] flex items-center justify-center mb-6">
                    <Icon className="w-8 h-8 text-[var(--color-primary)]" strokeWidth={1.5} />
                </div>
            )}
            <h2 className="text-2xl font-display text-[var(--color-primary)] mb-2">{title}</h2>
            {description && (
                <p className="text-stone-500 mb-8 max-w-sm font-body">{description}</p>
            )}
            {actionLabel && (
                actionTo ? (
                    <Link to={actionTo}>
                        <Button variant="primary" size="md">{actionLabel}</Button>
                    </Link>
                ) : (
                    <Button variant="primary" size="md" onClick={action}>
                        {actionLabel}
                    </Button>
                )
            )}
        </div>
    );
}
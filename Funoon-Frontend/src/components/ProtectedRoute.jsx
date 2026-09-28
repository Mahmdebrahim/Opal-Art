import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../features/auth/stores/authStore'
import UnauthorizedPage from '../features/pages/common/UnauthorizedPage'
import { ROUTES } from '../config/routes'

export default function ProtectedRoute({ roles, children }) {
    const { user, isAuthenticated } = useAuthStore()
    const location = useLocation()

    if (!isAuthenticated) {
        const returnPath = `${location.pathname}${location.search}${location.hash}`
        return <Navigate to={`${ROUTES.LOGIN}?redirect=${encodeURIComponent(returnPath)}`} replace />
    }

    // لو المستخدم مسجل بس بريده مش مؤكد → ارسله لصفحة التأكيد
    if (user && user.emailVerified === false) {
        return <Navigate to={`${ROUTES.VERIFY_EMAIL}?userId=${user._id}`} replace />
    }

    if (roles && roles.length && !roles.includes(user?.role)) {
        return <UnauthorizedPage />
    }
    return children
}
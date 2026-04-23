from fastapi import APIRouter, Depends
from app.api.v1 import auth, participants, programs, support_cases, evaluation_results, attachments, dashboard, imports
from app.api.deps import require_roles

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
protected_dependencies = [Depends(require_roles("ADMIN", "OPERATOR"))]
api_router.include_router(participants.router, prefix="/participants", tags=["participants"], dependencies=protected_dependencies)
api_router.include_router(programs.router, prefix="/programs", tags=["programs"], dependencies=protected_dependencies)
api_router.include_router(support_cases.router, prefix="/support-cases", tags=["support-cases"], dependencies=protected_dependencies)
api_router.include_router(evaluation_results.router, prefix="/evaluation-results", tags=["evaluation-results"], dependencies=protected_dependencies)
api_router.include_router(attachments.router, prefix="/attachments", tags=["attachments"], dependencies=protected_dependencies)
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"], dependencies=protected_dependencies)
api_router.include_router(imports.router, prefix="/imports", tags=["imports"], dependencies=protected_dependencies)

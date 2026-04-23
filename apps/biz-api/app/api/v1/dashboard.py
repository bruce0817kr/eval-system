from fastapi import APIRouter

router = APIRouter()


@router.get('/summary')
def summary():
    return {
        'program_count': 0,
        'in_progress_program_count': 0,
        'support_case_count': 0,
        'unsettled_count': 0,
        'recent_attachment_count': 0,
    }

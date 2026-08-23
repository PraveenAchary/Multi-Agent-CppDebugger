from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .graph_service import run_debug_agent
from .models import Submission

@api_view(["POST"])
@permission_classes([AllowAny])
def analyze_code(request):
    code = request.data.get("code", "")

    if not code.strip():
        return Response({"error": "No code provided"}, status=400)

    if not request.session.session_key:
        request.session.create()
    session_key = request.session.session_key

    result = run_debug_agent(code)

    Submission.objects.create(
        session_key=session_key,
        code=code,
        compiles=result["compiles"],
    )

    return Response(result)


    
@api_view(["GET"])
@permission_classes([AllowAny])
def get_history(request):
    if not request.session.session_key:
        return Response([])

    session_key = request.session.session_key
    submissions = Submission.objects.filter(session_key=session_key)[:3]

    data = [
        {"code": s.code, "compiles": s.compiles, "created_at": s.created_at}
        for s in submissions
    ]
    return Response(data)
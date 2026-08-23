from django.shortcuts import render

# Create your views here.
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .repair_service import repair_code

@api_view(["POST"])
@permission_classes([AllowAny])
def repair(request):
    code = request.data.get("code", "")
    diagnostics = request.data.get("diagnostics", {})

    if not code.strip():
        return Response({"error": "No code provided"}, status=400)

    try:
        fixed_code = repair_code(code, diagnostics)
    except RuntimeError as e:
        return Response({"error": str(e)}, status=500)

    return Response({"fixed_code": fixed_code})
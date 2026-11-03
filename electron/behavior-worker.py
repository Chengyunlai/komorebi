"""Local Laya inference. Stdout is a JSON-lines protocol, never model logs."""
import contextlib
import json
import sys
import time

QUESTIONS = {
    "behavior": {
        "type": "choice",
        "instructions": "What action does the user request?",
        "criteria": {
            "gentle": "Dance gently with small movements",
            "energetic": "Dance energetically with bigger movements",
            "stop": "Stop dancing and stay still",
            "other": "An unrelated task or conversation",
        },
    }
}
agent = None
for line in sys.stdin:
    request = json.loads(line)
    started = time.monotonic()
    try:
        with contextlib.redirect_stdout(sys.stderr):
            if agent is None:
                from laya import Router
                agent = Router(max_loaded=1, device="cpu", revision="7b928d828b7b0e022f929d9bd2e44165aa270148")
            result = agent.predict(request["text"], QUESTIONS, model="multilingual", lang="zh", min_confidence=0.75)
        answer = result["answers"]["behavior"]
        reply = {"id": request["id"], "choice": answer["choice"], "confidence": answer.get("answer_confidence", 0), "lowConfidence": bool(answer.get("low_confidence", False)), "elapsedMs": round((time.monotonic()-started)*1000), "model": "laya-multilingual"}
    except Exception as error:
        print(type(error).__name__ + ": " + str(error), file=sys.stderr, flush=True)
        reply = {"id": request["id"], "error": "Laya 本地模型未就绪，请检查运行环境和模型下载。"}
    print(json.dumps(reply, ensure_ascii=False), flush=True)

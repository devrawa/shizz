from decimal import Decimal, ROUND_HALF_UP


def draft_proposal(r):
    total = (Decimal(str(r.hours)) * Decimal(str(r.rate))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if r.language == "ckb":
        text = f"""# ڕەشنووسی پێشنیاری کار: {r.service}

بۆ: {r.client}

## کار و بەرهەمەکان
{r.deliverables}

## کات و تێچووی خەمڵێنراو
- کات: {r.hours:g} کاتژمێر
- نرخی کاتژمێر: {r.rate:g} {r.currency}
- کۆی خەمڵێنراو: {total} {r.currency}

## مەرجەکان
پێش دەستپێکردن، مەودای کار، مۆڵەت، کاتی تەواوبوون و پارەدان بە نووسین ڕێک بکەون.
بۆ پشکنینی ئاسایش، تەنها سیستەمە ڕێگەپێدراوەکان لە مەودای ڕێککەوتوو بپشکنە.
باج و تێچووی خزمەتگوزارییەکانی دەرەوە لەم نرخەدا نییە، مەگەر ڕێککەوتنێکی تر هەبێت.

ئەمە تەنها ڕەشنووسە؛ پێش ناردن پێداچوونەوەی بۆ بکە. هیچ داهاتێک مسۆگەر نییە.
"""
    else:
        text = f"""# Draft proposal: {r.service}

Prepared for: {r.client}

## Scope and deliverables
{r.deliverables}

## Estimate
- Estimated effort: {r.hours:g} hours
- Hourly rate: {r.rate:g} {r.currency}
- Estimated subtotal: {total} {r.currency}

## Assumptions and approval
Agree scope, acceptance criteria, timeline and payment terms in writing before work begins.
Cybersecurity work requires written authorization, exact assets, permitted methods and a stop contact.
Taxes, platform fees and external-service costs are excluded unless separately agreed.
No findings, vulnerabilities, rankings or earnings are guaranteed. Never claim qualifications you do not have.

Human review required. This is an unsent draft, not legal advice or a payment request.
"""
    return {"markdown": text, "subtotal": str(total), "currency": r.currency, "sent": False}

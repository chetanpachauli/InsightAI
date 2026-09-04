from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.core.config import settings

# Structured output Pydantic schemas for Gemini
class SQLQueryResponse(BaseModel):
    sql_query: str
    explanation: str
    chart_type: str # 'bar', 'line', 'pie', 'table', 'none'
    x_axis_column: Optional[str] = None
    y_axis_column: Optional[str] = None

class InsightRecommendationResponse(BaseModel):
    key_findings: list[str]     # Bullet points of what is happening
    recommendations: list[str]  # Bullet points of actions to take

class CategoryMapping(BaseModel):
    narrative: str
    category: str

class BatchCategoryResponse(BaseModel):
    mappings: list[CategoryMapping]

class GeminiService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.client = None
        if self.api_key:
            # Initialize the official Google GenAI Client
            self.client = genai.Client(api_key=self.api_key)

    def is_configured(self) -> bool:
        return self.client is not None

    def generate_sql_from_nl(
        self,
        user_question: str,
        schema_description: str,
        conversation_history: Optional[list[dict]] = None
    ) -> SQLQueryResponse:
        """
        Convert a user's natural language question (Hindi, Hinglish, or English) into
        a VALID and SAFE PostgreSQL SQL query based on database schemas.
        """
        if not self.is_configured():
            # Return a fallback dry run mock response if Gemini is not configured yet
            return SQLQueryResponse(
                sql_query="SELECT region, SUM(amount) AS total_sales FROM sales_data GROUP BY region;",
                explanation="Gemini API Key is not configured. Showing mock SQL query.",
                chart_type="bar",
                x_axis_column="region",
                y_axis_column="total_sales"
            )

        history_context = ""
        if conversation_history:
            history_lines = []
            for msg in conversation_history[-6:]:  # Keep last 6 exchanges for context
                role = "User" if msg.get("sender") == "user" else "Assistant"
                history_lines.append(f"{role}: {msg.get('text', '')}")
            history_context = "\nRecent Conversation History:\n" + "\n".join(history_lines) + "\n"

        prompt = f"""
        You are a bilingual senior data analyst and expert SQL architect for an enterprise MIS platform.
        You understand queries in Hindi (हिंदी), Hinglish (e.g. 'Last month me highest sales ka product dikhao'), and English.

        Database Schemas & Sample Information:
        {schema_description}
        {history_context}
        User's Current Question: "{user_question}"

        Task:
        1. Translate the user's intent into a VALID, SAFE, and READ-ONLY PostgreSQL SELECT query.
        2. Write the explanation in the SAME language/dialect the user asked in:
           - If asked in Hindi, explain in natural Hindi (e.g. 'दिसंबर 2025 में कुल बिक्री ₹45,23,890 रही...')
           - If asked in Hinglish, explain in friendly Hinglish (e.g. 'Last month total sales ₹45,23,890 thi...')
           - If asked in English, explain in professional English.
        3. MULTI-TABLE JOINS: If the question spans across multiple uploaded datasets (e.g., sales joined with customer_info or products), identify matching foreign key columns and use INNER JOIN or LEFT JOIN with table prefixes (table.column).
        4. Select an optimal chart type ('bar', 'line', 'pie', 'table', or 'none') and assign appropriate x_axis_column and y_axis_column aliases.
        5. CRITICAL: Output strictly read-only SELECT statements. Never output INSERT, UPDATE, DELETE, DROP, or ALTER.
        """

        for model_name in ['gemini-2.0-flash', 'gemini-1.5-flash']:
            try:
                response = self.client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=SQLQueryResponse,
                        temperature=0.1
                    ),
                )
                import json
                data = json.loads(response.text)
                return SQLQueryResponse(**data)
            except Exception:
                continue

        # Fallback if both model calls fail
        return SQLQueryResponse(
            sql_query="SELECT * FROM uploaded_files LIMIT 5;",
            explanation="Unable to process AI query at this moment. Please verify table connections.",
            chart_type="none"
        )

    def generate_insights(self, data_summary_json: str) -> InsightRecommendationResponse:
        """
        Analyze database metrics summaries and write key executive insights & business suggestions.
        """
        if not self.is_configured():
            return InsightRecommendationResponse(
                key_findings=[
                    "Gemini API key is missing. Add GEMINI_API_KEY in your .env file to enable AI insights.",
                    "Active server is processing data, but automated AI analysis is offline."
                ],
                recommendations=[
                    "Get a free API key from Google AI Studio.",
                    "Paste the key into the .env file in the backend folder."
                ]
            )

        prompt = f"""
        You are an Enterprise business intelligence consultant.
        Analyze this company sales and operations metric report (JSON format):
        {data_summary_json}

        Write an executive summary divided into:
        1. Key Findings: What is the data telling us? Any anomalies, drop in sales, or high-performing assets?
        2. Recommendations: Actionable next steps the managers should take to optimize operations, improve sales, or handle low stock.
        """

        try:
            response = self.client.models.generate_content(
                model='gemini-3.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=InsightRecommendationResponse,
                    temperature=0.5
                ),
            )
            import json
            data = json.loads(response.text)
            return InsightRecommendationResponse(**data)
        except Exception as e:
            return InsightRecommendationResponse(
                key_findings=[f"Failed to generate AI insights: {str(e)}"],
                recommendations=["Please check your Gemini API key validity and connection status."]
            )

    def categorize_narratives(self, narratives: list[str]) -> dict[str, str]:
        """Categorize unique transaction descriptions into standard buckets using Gemini structured output."""
        import json
        
        # Local keyword classifier fallback if Gemini key is absent or empty list
        if not self.is_configured() or not narratives:
            fallback = {}
            for n in narratives:
                n_lower = n.lower()
                if any(x in n_lower for x in ["zomato", "swiggy", "food", "restaurant", "lunch", "tea", "coffee", "tapri", "starbucks", "cafe"]):
                    fallback[n] = "Food & Dining"
                elif any(x in n_lower for x in ["rent", "home", "flat", "owner"]):
                    fallback[n] = "Rent & Utilities"
                elif any(x in n_lower for x in ["amazon", "zara", "clothing", "shopping", "fashion", "flipkart", "retail"]):
                    fallback[n] = "Shopping & Lifestyle"
                elif any(x in n_lower for x in ["uber", "taxi", "ride", "petrol", "fuel", "gas", "shell"]):
                    fallback[n] = "Travel & Fuel"
                elif any(x in n_lower for x in ["salary", "credited", "income", "company", "pay"]):
                    fallback[n] = "Salary & Income"
                elif any(x in n_lower for x in ["netflix", "entertainment", "movie", "bookmyshow", "show"]):
                    fallback[n] = "Entertainment"
                elif any(x in n_lower for x in ["utility", "electricity", "fiber", "broadband", "power", "bill", "tata power", "act fiber"]):
                    fallback[n] = "Rent & Utilities"
                else:
                    fallback[n] = "Miscellaneous"
            return fallback

        prompt = f"""
        You are a financial transactions classifier.
        Categorize the following transaction narratives into standard category buckets:
        - "Food & Dining" (restaurants, daily food, coffee, tea, dining out, swiggy, zomato)
        - "Rent & Utilities" (rent, broadband bills, electricity, power, rent transfers, broadband)
        - "Shopping & Lifestyle" (clothing stores, retail, Amazon, Flipkart shopping, fashion)
        - "Travel & Fuel" (cabs, Uber, petrol, gas, fuel stations, rides)
        - "Salary & Income" (salary deposit, credits, incoming funds, pay)
        - "Entertainment" (movies, subscriptions like Netflix, books, shows)
        - "Miscellaneous" (unclassified or others)

        Narratives to classify:
        {json.dumps(narratives)}
        """

        try:
            response = self.client.models.generate_content(
                model='gemini-3.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=BatchCategoryResponse,
                    temperature=0.1
                )
            )
            data = json.loads(response.text)
            return {item["narrative"]: item["category"] for item in data.get("mappings", [])}
        except Exception as e:
            print(f"Gemini categorization failed: {str(e)}. Using fallback local keyword classifier.")
            # Trigger fallback
            fallback_dict = {}
            for n in narratives:
                n_lower = n.lower()
                if any(x in n_lower for x in ["zomato", "swiggy", "food", "restaurant", "lunch", "tea", "coffee", "tapri", "starbucks", "cafe"]):
                    fallback_dict[n] = "Food & Dining"
                elif any(x in n_lower for x in ["rent", "home", "flat", "owner"]):
                    fallback_dict[n] = "Rent & Utilities"
                elif any(x in n_lower for x in ["amazon", "zara", "clothing", "shopping", "fashion", "flipkart", "retail"]):
                    fallback_dict[n] = "Shopping & Lifestyle"
                elif any(x in n_lower for x in ["uber", "taxi", "ride", "petrol", "fuel", "gas", "shell"]):
                    fallback_dict[n] = "Travel & Fuel"
                elif any(x in n_lower for x in ["salary", "credited", "income", "company", "pay"]):
                    fallback_dict[n] = "Salary & Income"
                elif any(x in n_lower for x in ["netflix", "entertainment", "movie", "bookmyshow", "show"]):
                    fallback_dict[n] = "Entertainment"
                elif any(x in n_lower for x in ["utility", "electricity", "fiber", "broadband", "power", "bill", "tata power", "act fiber"]):
                    fallback_dict[n] = "Rent & Utilities"
                else:
                    fallback_dict[n] = "Miscellaneous"
            return fallback_dict

# Instantiate singleton service
gemini_service = GeminiService()

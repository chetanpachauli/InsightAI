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

    def generate_sql_from_nl(self, user_question: str, schema_description: str) -> SQLQueryResponse:
        """
        Convert a user's natural language question into a PostgreSQL SQL query
        based on the provided database table schemas.
        """
        if not self.is_configured():
            # Return a fallback dry run mock response if Gemini is not configured yet
            return SQLQueryResponse(
                sql_query="SELECT region, SUM(amount) FROM sales_data GROUP BY region;",
                explanation="Gemini API Key is not configured. Showing mock SQL query.",
                chart_type="bar",
                x_axis_column="region",
                y_axis_column="SUM(amount)"
            )

        prompt = f"""
        You are a senior data analyst and expert SQL writer.
        Given the following PostgreSQL database table schemas:
        {schema_description}

        Convert the user's natural language question into a VALID and SAFE PostgreSQL read-only SQL query.
        User question: "{user_question}"

        Guidelines:
        1. Only generate read-only SELECT queries. Never write INSERT, UPDATE, DELETE, or DROP.
        2. Ensure column names and table names match the schema exactly.
        3. Determine if the data can be visualized using a chart. If yes, specify the chart type ('bar', 'line', 'pie') and identify which columns to map to the X and Y axes.
        4. If it's a simple single-value response or table-only report, set chart_type to 'table' or 'none'.
        """

        try:
            response = self.client.models.generate_content(
                model='gemini-1.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=SQLQueryResponse,
                    temperature=0.1 # Low temperature for strict SQL syntax correctness
                ),
            )
            # Response text will be automatically validated and parsed against SQLQueryResponse Pydantic schema
            import json
            data = json.loads(response.text)
            return SQLQueryResponse(**data)
        except Exception as e:
            # Return error explanation fallback
            return SQLQueryResponse(
                sql_query="SELECT * FROM uploaded_files LIMIT 5;",
                explanation=f"Error running Gemini API: {str(e)}",
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
                model='gemini-1.5-flash',
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
                model='gemini-1.5-flash',
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

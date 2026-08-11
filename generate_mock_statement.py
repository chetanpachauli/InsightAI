import csv
import random
from datetime import datetime, timedelta

def generate_mock_bank_statement():
    filename = "bank_statement_test.csv"
    start_date = datetime(2026, 7, 1)
    
    # Narratives with expected category mappings
    transactions = [
        {"desc": "Zomato Online Food Delivery", "type": "debit", "min": 250, "max": 1200},
        {"desc": "Uber India Rides Taxi", "type": "debit", "min": 150, "max": 600},
        {"desc": "Amazon Retail India Pvt Ltd", "type": "debit", "min": 500, "max": 5000},
        {"desc": "Netflix Entertainment Subscription", "type": "debit", "min": 649, "max": 649},
        {"desc": "Swiggy Daily Lunch Order", "type": "debit", "min": 180, "max": 800},
        {"desc": "HDFC Home Rent Transfer", "type": "debit", "min": 18000, "max": 18000},
        {"desc": "Zara Clothing Fashion Store", "type": "debit", "min": 2000, "max": 7000},
        {"desc": "Shell Fuel Gas Station", "type": "debit", "min": 1000, "max": 3500},
        {"desc": "Local Chai Tapri Tap Tea", "type": "debit", "min": 20, "max": 80},
        {"desc": "Starbucks Coffee Cafe", "type": "debit", "min": 350, "max": 950},
        {"desc": "Flipkart Internet Shopping", "type": "debit", "min": 800, "max": 4000},
        {"desc": "Act Fiber Broadband Bill", "type": "debit", "min": 999, "max": 999},
        {"desc": "Tata Power Utility Electricity Bill", "type": "debit", "min": 1200, "max": 4500},
        {"desc": "BookMyShow Movie Tickets", "type": "debit", "min": 400, "max": 1200},
    ]
    
    balance = 85000.00
    rows = []
    
    # 1. Salary Credit at start of month
    rows.append({
        "Date": start_date.strftime("%Y-%m-%d"),
        "Description": "SALARY CREDIT - COMPANY PAY",
        "Debit": "",
        "Credit": "75000.00",
        "Balance": f"{balance + 75000.00:.2f}"
    })
    balance += 75000.00
    
    # 2. Add randomized daily transactions
    current_date = start_date
    for i in range(1, 30):
        current_date += timedelta(days=random.choice([0, 1, 2]))
        
        # 30% chance of a no-spending day
        if random.random() < 0.3:
            continue
            
        tx = random.choice(transactions)
        amount = random.randint(tx["min"], tx["max"]) if tx["min"] != tx["max"] else tx["min"]
        
        if tx["type"] == "debit":
            debit_str = f"{amount:.2f}"
            credit_str = ""
            balance -= amount
        else:
            debit_str = ""
            credit_str = f"{amount:.2f}"
            balance += amount
            
        rows.append({
            "Date": current_date.strftime("%Y-%m-%d"),
            "Description": tx["desc"],
            "Debit": debit_str,
            "Credit": credit_str,
            "Balance": f"{balance:.2f}"
        })
        
    # Write to CSV
    with open(filename, mode='w', newline='', encoding='utf-8') as f:
        fieldnames = ["Date", "Description", "Debit", "Credit", "Balance"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)
            
    print(f"Generated sample bank statement at: {filename}")

if __name__ == "__main__":
    generate_mock_bank_statement()

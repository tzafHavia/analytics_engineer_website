# 🏪 Convenience Store Analytics Platform

## 🎯 Project Overview

This project was built for a real convenience store business that struggled to extract meaningful insights from its POS system.

While the system collected valuable data, it lacked the ability to generate useful reports for business management and accounting needs.

The goal was to design a complete data solution that transforms raw POS data into actionable insights.

---

## ❗ The Problem

The business faced several key challenges:

### 1. Poor Data Export Capabilities

The POS system did not provide data in a format suitable for accounting or reporting.

### 2. High Cost of Vendor Solutions

The POS provider (Verifone) offered advanced reporting features, but at a high recurring cost.

### 3. Limited Built-in Reports

The existing reports were very basic and did not support real business analysis.

---

## 📊 Business Requirements

The client needed the following reports:

### 📅 Monthly Reports

* Employee working hours report
* Employee compensation report

### 📦 Annual Report

* Inventory report (stock levels, movement)

### 📈 Weekly Insights (every Sunday)

For each day of the previous week:

* Total sales
* Total costs
* Profit
* Top 10 selling products

---

## 🚀 Solution

A full data pipeline and analytics system was built:

* Automated nightly data ingestion from POS backups
* Data transformation using dbt
* Storage in a structured analytics database (Supabase)
* API layer for controlled data access
* Interactive dashboards for business insights

---

## 🧠 Data Architecture

Raw POS Data → dbt Transformation → Analytics Database → API → Dashboard

---

## 📊 Key Dashboards

### 🏪 Sales Performance Dashboard

* Daily / weekly / monthly revenue
* Profit trends
* Cost vs revenue comparison

### 👥 Employee Analytics

* Total hours per employee
* Salary estimation
* Productivity (sales per hour)

### 📦 Inventory Insights

* Stock levels
* Fast vs slow moving products
* Inventory turnover

### 📅 Weekly Summary Dashboard

* Daily breakdown of:

  * Revenue
  * Costs
  * Profit
* Top 10 products per day

---

## 💡 Advanced Metrics (Added Beyond Requirements)

To provide deeper insights, additional KPIs were implemented:

### 💰 Financial Metrics

* Average basket size
* Revenue per hour
* Profit margin (%)

### 🛒 Product Analytics

* Top selling products
* Low-performing products
* Category contribution to revenue

### ⏰ Time-Based Insights

* Peak hours (by sales volume)
* Peak days of the week

### 👥 Employee Performance

* Sales per employee
* Revenue per hour worked

---

## 📈 Key Insights

* A small number of products generated a large portion of revenue
* Peak sales hours consistently occurred in the evening
* Some high-cost products had low sales and reduced profitability
* Employee productivity varied significantly

---

## 🎯 Business Impact

* Eliminated the need for expensive vendor reporting tools
* Enabled data-driven decision making
* Improved inventory planning
* Helped optimize staffing based on demand

---

## 🛠️ Tech Stack

* SQL
* dbt
* Supabase (PostgreSQL)
* Next.js (Frontend + API)
* Power BI / Tableau (Visualization)

---

## 🔗 Links

* GitHub Repository
* Live Dashboard

---

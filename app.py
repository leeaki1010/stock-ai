import streamlit as st
import yfinance as yf
import pandas as pd

st.set_page_config(page_title="AI股票分析", layout="wide")

st.title("📈 AI股票分析（科技七巨头）")

stocks = {
    "AAPL": "Apple",
    "MSFT": "Microsoft",
    "GOOGL": "Alphabet",
    "AMZN": "Amazon",
    "NVDA": "Nvidia",
    "META": "Meta",
    "TSLA": "Tesla"
}

stock = st.selectbox("选择股票", list(stocks.keys()))

@st.cache_data
def load_data(ticker):
    df = yf.download(ticker, period="6mo", interval="1d")
    return df

df = load_data(stock)

# 计算指标（不用ta-lib，避免部署问题）
df['EMA12'] = df['Close'].ewm(span=12).mean()
df['EMA26'] = df['Close'].ewm(span=26).mean()
df['MACD'] = df['EMA12'] - df['EMA26']
df['Signal'] = df['MACD'].ewm(span=9).mean()

delta = df['Close'].diff()
gain = (delta.where(delta > 0, 0)).rolling(14).mean()
loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
rs = gain / loss
df['RSI'] = 100 - (100 / (1 + rs))

latest = df.iloc[-1]

# 打分逻辑
score = 0

if latest['MACD'] > latest['Signal']:
    score += 50

if latest['RSI'] < 30:
    score += 30
elif latest['RSI'] < 50:
    score += 10

if latest['RSI'] > 70:
    sell_risk = "高"
elif latest['RSI'] > 50:
    sell_risk = "中"
else:
    sell_risk = "低"

trend = "上涨" if latest['MACD'] > latest['Signal'] else "震荡/下跌"

# 页面展示
col1, col2 = st.columns(2)

with col1:
    st.subheader("📊 数据")
    st.write("当前价格:", round(latest['Close'], 2))
    st.write("RSI:", round(latest['RSI'], 2))
    st.write("MACD:", round(latest['MACD'], 2))

with col2:
    st.subheader("🤖 AI分析")
    st.write("趋势:", trend)
    st.write("买入评分:", score)
    st.write("卖出风险:", sell_risk)
    st.write("建议:", "✅ 偏多（可考虑）" if score > 60 else "⚠️ 观望")

st.subheader("📈 K线图")
st.line_chart(df['Close'])

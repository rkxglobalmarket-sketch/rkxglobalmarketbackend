import express, { Request, Response } from "express";

const app = express.Router();

app.get("/yahoo/chart", async (req, res) => {
    const { symbol, from, to, interval } = req.query;

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${from}&period2=${to}&interval=${interval}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (_e) {
        res.status(500).json({ error: "Yahoo fetch failed" });
    }
});

interface PriceData {
    symbol: string;
    price: number;
    changePercent: number;
}

interface CacheEntry {
    data: PriceData;
    timestamp: number;
}

const priceCache: Record<string, CacheEntry> = {};

async function fetchPrice(symbol: string): Promise<PriceData | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
            symbol
        )}?interval=1m&range=1d`;

        const res = await fetch(url);
        const data = await res.json();

        const result = data.chart?.result?.[0];
        if (!result) return null;

        const timestamps: number[] = result.timestamp;
        const closes: (number | null)[] = result.indicators?.quote?.[0]?.close;

        if (!timestamps?.length || !closes?.length) return null;

        const latestPrice = closes[closes.length - 1]!;
        const previousPrice = closes[closes.length - 2] ?? latestPrice;

        const changePercent = ((latestPrice - previousPrice) / previousPrice) * 100;

        return {
            symbol,
            price: latestPrice,
            changePercent,
        };
    } catch (err) {
        console.error("Yahoo fetch error:", err);
        return null;
    }
}

app.get("/price/:symbol", async (req: Request, res: Response) => {
    const symbol = req.params.symbol;

    const now = Date.now();
    const cache = priceCache[symbol];

    if (cache && now - cache.timestamp < 10000) {
        return res.json(cache.data);
    }

    const data = await fetchPrice(symbol);

    if (!data) return res.status(500).json({ error: "Failed to fetch price" });

    priceCache[symbol] = { data, timestamp: now };

    res.json(data);
});

app.get("/yahoo/chart/formatted", async (req, res) => {
    const INTERVAL_MAP: Record<string, string> = {
        "1m": "1M",
        "5m": "5M",
        "15m": "15M",
        "30m": "30M",
        "1h": "1H",
        "1d": "1D",
    };

    const { symbol, from, to, interval } = req.query;

    if (!symbol || !from || !to || !interval) {
        return res.status(400).json({ error: "Missing query params" });
    }

    const yahooInterval = interval as string;
    const mappedInterval = INTERVAL_MAP[yahooInterval];

    if (!mappedInterval) {
        return res.status(400).json({ error: "Unsupported interval" });
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${from}&period2=${to}&interval=${yahooInterval}`;

    try {
        const response = await fetch(url);
        const json = await response.json();

        const result = json?.chart?.result?.[0];
        if (!result) {
            return res.status(500).json({ error: "Invalid Yahoo response" });
        }

        const timestamps = result.timestamp || [];
        const quote = result.indicators?.quote?.[0] || {};

        const { open = [], high = [], low = [], close = [] } = quote;

        const candles = [];

        for (let i = 0; i < timestamps.length; i++) {
            if (
                open[i] == null ||
                high[i] == null ||
                low[i] == null ||
                close[i] == null
            ) {
                continue;
            }

            candles.push({
                time: new Date(timestamps[i] * 1000)
                    .toISOString()
                    .replace("T", " ")
                    .slice(0, 16),
                open: Number(open[i]),
                high: Number(high[i]),
                low: Number(low[i]),
                close: Number(close[i]),
            });
        }

        res.json({
            interval: mappedInterval,
            data: candles,
        });

    } catch (_e) {
        res.status(500).json({ error: "Yahoo fetch failed" });
    }
});

import fs from 'fs';
import path from 'path';

const BALANCES_FILE = path.resolve(__dirname, 'balances.json');

const loadBalances = (): Record<string, number> => {
    try {
        if (fs.existsSync(BALANCES_FILE)) {
            const data = fs.readFileSync(BALANCES_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (_error) {
        console.error('Error loading balances:', _error);
    }
    return {};
};

const saveBalances = (balances: Record<string, number>): void => {
    try {
        fs.writeFileSync(BALANCES_FILE, JSON.stringify(balances, null, 2), 'utf-8');
        console.log('Balances saved to:', BALANCES_FILE);
    } catch (_error) {
        console.error('Error saving balances:', _error);
    }
};

export class BalanceManager {
    static getBalance(userId: string): number {
        const balances = loadBalances();
        return balances[userId] || 0;
    }

    static setBalance(userId: string, amount: number): void {
        const balances = loadBalances();
        balances[userId] = amount;
        saveBalances(balances);
    }

    static adjustBalance(userId: string, amount: number): void {
        const balances = loadBalances();
        balances[userId] = (balances[userId] || 0) + amount;
        saveBalances(balances);
    }
}

app.post("/register", (req, res) => {
    const { uid } = req.body;
    if (!uid) {
        return res.status(400).json({ error: "Missing userId" });
    }
    BalanceManager.setBalance(uid, 0);
    res.json({ message: "User registered", balance: BalanceManager.getBalance(uid) });
});

app.get("/balance/:userId", (req, res) => {
    const userId = req.params.userId;
    const balance = BalanceManager.getBalance(userId);
    res.json({ userId, balance });
});

app.put("/balance/:userId", (req, res) => {
    const userId = req.params.userId;
    const { amount } = req.body;
    if (typeof amount !== "number") {
        return res.status(400).json({ error: "Invalid amount" });
    }
    BalanceManager.setBalance(userId, amount);
    res.json({ userId, balance: BalanceManager.getBalance(userId) });
});

export default app;

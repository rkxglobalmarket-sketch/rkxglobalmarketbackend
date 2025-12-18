import fs from 'fs';
import path from 'path';

let balances: Record<string, number> = {};

const loadBalances = (): void => {
    try {
        const filePath = path.join(__dirname, 'balances.json');
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            balances = JSON.parse(data);
        }
    } catch (error) {
        balances = {};
    }
}

export class BalanceManager {
    static {
        loadBalances();
    }

    static getBalance(userId: string): number {
        return balances[userId] || 0;
    }

    static saveBalances(): void {
        const filePath = path.join(__dirname, 'balances.json');
        fs.writeFileSync(filePath, JSON.stringify(balances, null, 2));
    }

    static setBalance(userId: string, amount: number): void {
        balances[userId] = amount;
        this.saveBalances();
    }
    static adjustBalance(userId: string, amount: number): void {
        balances[userId] = (balances[userId] || 0) + amount;
        this.saveBalances();
    }
}
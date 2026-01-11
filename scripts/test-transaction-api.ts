import { queryTransactions } from '../lib/services/transaction-service';

async function test() {
  try {
    console.log('Testing transaction service...');
    const result = await queryTransactions({
      page: 1,
      perPage: 10,
    });
    console.log('Success!');
    console.log('Total transactions:', result.total);
    console.log('Transactions found:', result.transactions.length);
    if (result.transactions.length > 0) {
      console.log('First transaction:', result.transactions[0]);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

test();

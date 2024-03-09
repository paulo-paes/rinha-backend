import Koa from 'koa';
import parser from 'koa-bodyparser';
import Router from 'koa-router';
import { Pool, PoolClient } from 'pg';


const app = new Koa();
const router = new Router();

const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'rinha',
  password: '123',
  port: 5432
})

const runWarmup = async () => {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
} 

setTimeout(() => {
  pool.connect().then(() => {
    console.log('Connected to database');
    const promises: Promise<any>[] = [];
    for (let i = 0; i < 100; i++) {
      promises.push(runWarmup().then(() => console.log('finished warmup')).catch((err) => console.log('Error running warmup', err)));
    }
    Promise.all(promises).then(() => {
      console.log('Warmup finished');
    }).catch((err) => {
      console.log('Error running warmup', err);
    });
  }).catch((err) => {
    console.log('Error connecting to database', err);
    process.exit(1);
  });
}, 10000);

type Customer = {
  id?: number;
  limite: number;
  saldo: number;
}

type CustomerWithTransactions = {
  saldo: {
    total: number;
    data_extrato: Date;
    limite: number;
  };
  ultimas_transacoes: {
    valor: number;
    tipo: string;
    descricao: string;
    realizada_em: Date;
  }[]
}

const getCustomer = async (id: number, client: PoolClient): Promise<Customer> => {
  const res = await client.query('SELECT * FROM clientes WHERE id = $1 FOR UPDATE', [id]);
  return res.rows[0];
}

router.post('/clientes/:id/transacoes', async (ctx) => {

  const body = ctx.request.body as any;
  const valor = Number(body.valor);
  const tipo = body.tipo;
  const id = Number(ctx.params.id);
  const descricao = body.descricao;
  if (!ctx.params.id || isNaN(id)) {
    ctx.status = 404;
    return
  }

  if (id < 1 || id > 5) {
    ctx.status = 404;
    return
  }

  if (!descricao || descricao.length < 1 || descricao.length > 10) {
    ctx.status = 400;
    return
  }

  if (tipo !== 'c' && tipo !== 'd') {
    ctx.status = 400;
    return
  }

  const vlrStr = String(body.valor);

  if (!valor || isNaN(valor) || vlrStr.includes('.') || vlrStr.includes(',')) {
    ctx.status = 400;
    return
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const customer = await getCustomer(id, client);
    customer.limite = Number(customer.limite);
    customer.saldo = Number(customer.saldo);
    if (tipo === 'd') {
      if (valor > customer.limite + customer.saldo) {
        ctx.status = 422;
        await client.query('ROLLBACK');
        return
      }
      customer.saldo -= valor;
    } else if (tipo === 'c') {
      customer.saldo += valor;
    }
    
    
    await client.query('INSERT INTO transacoes (valor, descricao, tipo, cliente_id) VALUES ($1, $2, $3, $4)', [valor, descricao, tipo, id]);
    await client.query('UPDATE clientes SET saldo = $1 WHERE id = $2', [customer.saldo, id]);
    await client.query('COMMIT');
    
    ctx.body = {
      limite: customer.limite,
      saldo: customer.saldo,
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release()
  }
});

router.get('/clientes/:id/extrato', async (ctx) => {
  const id = Number(ctx.params.id);
  if (!ctx.params.id || isNaN(id)) {
    ctx.status = 404;
    return
  }

  if (id < 1 || id > 5) {
    ctx.status = 404;
    return
  }
  let client: any;
  try {
    client = await pool.connect();
    const customer = await getCustomer(id, client);
    const res: CustomerWithTransactions = {
      saldo: {
        total: Number(customer.saldo),
        data_extrato: new Date(),
        limite: Number(customer.limite)
      },
      ultimas_transacoes: []
    }
    let query = 'SELECT valor, tipo, descricao, realizada_em FROM transacoes WHERE cliente_id = $1 ORDER BY realizada_em DESC LIMIT 10';
  
    res.ultimas_transacoes = (await client.query(query, [id])).rows;
    res.ultimas_transacoes.forEach((t) => {
      t.valor = Number(t.valor);
    });
    delete customer.id;
    ctx.body = res;
  } finally {
    client.release();
  }
});

app.use(parser());
app.use(router.routes());


app.listen(process.env.APP_PORT, () => {
  console.log('App listening to port ' + process.env.APP_PORT)
});
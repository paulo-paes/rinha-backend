import Koa from 'koa';

const app = new Koa();



app.listen(3000, () => {
  console.log('App listening to port 3000')
});
CREATE TABLE clientes(
  id INT PRIMARY KEY,
  limite DECIMAL(10,0),
  saldo DECIMAL(10,0)
);

CREATE TABLE transacoes (
  id SERIAL PRIMARY KEY,
  cliente_id INT,
  valor DECIMAL(10,0),
  tipo char(1),
  descricao varchar(10),
  realizada_em timestamp default now(),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

INSERT INTO clientes VALUES (1, 100000, 0),
(2, 80000, 0),
(3, 1000000, 0),
(4, 10000000, 0),
(5, 500000, 0);

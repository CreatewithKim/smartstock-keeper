
ALTER TABLE public.products ADD CONSTRAINT products_user_local_uniq UNIQUE (user_id, local_id);
ALTER TABLE public.stock_intakes ADD CONSTRAINT stock_intakes_user_local_uniq UNIQUE (user_id, local_id);
ALTER TABLE public.sales ADD CONSTRAINT sales_user_local_uniq UNIQUE (user_id, local_id);
ALTER TABLE public.excess_sales ADD CONSTRAINT excess_sales_user_local_uniq UNIQUE (user_id, local_id);
ALTER TABLE public.products_out ADD CONSTRAINT products_out_user_local_uniq UNIQUE (user_id, local_id);
ALTER TABLE public.expenses ADD CONSTRAINT expenses_user_local_uniq UNIQUE (user_id, local_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_intakes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.excess_sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products_out;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;

ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.stock_intakes REPLICA IDENTITY FULL;
ALTER TABLE public.sales REPLICA IDENTITY FULL;
ALTER TABLE public.excess_sales REPLICA IDENTITY FULL;
ALTER TABLE public.products_out REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;

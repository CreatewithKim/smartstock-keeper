-- 1) Add user_id column to all data tables (nullable first for backfill)
ALTER TABLE public.products       ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.sales          ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.stock_intakes  ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.excess_sales   ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.products_out   ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.expenses       ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2) Backfill existing rows to the first admin user, if one exists
DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT user_id INTO admin_id
  FROM public.user_roles
  WHERE role = 'admin'
  LIMIT 1;

  IF admin_id IS NOT NULL THEN
    UPDATE public.products       SET user_id = admin_id WHERE user_id IS NULL;
    UPDATE public.sales          SET user_id = admin_id WHERE user_id IS NULL;
    UPDATE public.stock_intakes  SET user_id = admin_id WHERE user_id IS NULL;
    UPDATE public.excess_sales   SET user_id = admin_id WHERE user_id IS NULL;
    UPDATE public.products_out   SET user_id = admin_id WHERE user_id IS NULL;
    UPDATE public.expenses       SET user_id = admin_id WHERE user_id IS NULL;
  END IF;
END $$;

-- 3) Delete any remaining unowned rows (no admin existed) so we can enforce NOT NULL
DELETE FROM public.products       WHERE user_id IS NULL;
DELETE FROM public.sales          WHERE user_id IS NULL;
DELETE FROM public.stock_intakes  WHERE user_id IS NULL;
DELETE FROM public.excess_sales   WHERE user_id IS NULL;
DELETE FROM public.products_out   WHERE user_id IS NULL;
DELETE FROM public.expenses       WHERE user_id IS NULL;

-- 4) Enforce NOT NULL
ALTER TABLE public.products       ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.sales          ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.stock_intakes  ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.excess_sales   ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.products_out   ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.expenses       ALTER COLUMN user_id SET NOT NULL;

-- 5) Indexes for fast per-user queries
CREATE INDEX IF NOT EXISTS idx_products_user_id      ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id         ON public.sales(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_intakes_user_id ON public.stock_intakes(user_id);
CREATE INDEX IF NOT EXISTS idx_excess_sales_user_id  ON public.excess_sales(user_id);
CREATE INDEX IF NOT EXISTS idx_products_out_user_id  ON public.products_out(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id      ON public.expenses(user_id);

-- 6) Replace permissive policies with per-user policies on every table

-- products
DROP POLICY IF EXISTS "Authenticated users can read products"   ON public.products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Only admins can delete products"         ON public.products;
DROP POLICY IF EXISTS "Admins can view products"                ON public.products;

CREATE POLICY "Users can view their own products"
  ON public.products FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert their own products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own products"
  ON public.products FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own products or admins"
  ON public.products FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- sales
DROP POLICY IF EXISTS "Authenticated users can read sales"   ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can update sales" ON public.sales;
DROP POLICY IF EXISTS "Only admins can delete sales"         ON public.sales;
DROP POLICY IF EXISTS "Admins can view sales"                ON public.sales;

CREATE POLICY "Users can view their own sales"
  ON public.sales FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert their own sales"
  ON public.sales FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sales"
  ON public.sales FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sales or admins"
  ON public.sales FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- stock_intakes
DROP POLICY IF EXISTS "Authenticated users can read stock_intakes"   ON public.stock_intakes;
DROP POLICY IF EXISTS "Authenticated users can insert stock_intakes" ON public.stock_intakes;
DROP POLICY IF EXISTS "Authenticated users can update stock_intakes" ON public.stock_intakes;
DROP POLICY IF EXISTS "Only admins can delete stock_intakes"         ON public.stock_intakes;
DROP POLICY IF EXISTS "Admins can view stock_intakes"                ON public.stock_intakes;

CREATE POLICY "Users can view their own stock_intakes"
  ON public.stock_intakes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert their own stock_intakes"
  ON public.stock_intakes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own stock_intakes"
  ON public.stock_intakes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own stock_intakes or admins"
  ON public.stock_intakes FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- excess_sales
DROP POLICY IF EXISTS "Authenticated users can read excess_sales"   ON public.excess_sales;
DROP POLICY IF EXISTS "Authenticated users can insert excess_sales" ON public.excess_sales;
DROP POLICY IF EXISTS "Authenticated users can update excess_sales" ON public.excess_sales;
DROP POLICY IF EXISTS "Only admins can delete excess_sales"         ON public.excess_sales;
DROP POLICY IF EXISTS "Admins can view excess_sales"                ON public.excess_sales;

CREATE POLICY "Users can view their own excess_sales"
  ON public.excess_sales FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert their own excess_sales"
  ON public.excess_sales FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own excess_sales"
  ON public.excess_sales FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own excess_sales or admins"
  ON public.excess_sales FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- products_out
DROP POLICY IF EXISTS "Authenticated users can read products_out"   ON public.products_out;
DROP POLICY IF EXISTS "Authenticated users can insert products_out" ON public.products_out;
DROP POLICY IF EXISTS "Authenticated users can update products_out" ON public.products_out;
DROP POLICY IF EXISTS "Only admins can delete products_out"         ON public.products_out;
DROP POLICY IF EXISTS "Admins can view products_out"                ON public.products_out;

CREATE POLICY "Users can view their own products_out"
  ON public.products_out FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert their own products_out"
  ON public.products_out FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own products_out"
  ON public.products_out FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own products_out or admins"
  ON public.products_out FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- expenses
DROP POLICY IF EXISTS "Authenticated users can read expenses"   ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Only admins can delete expenses"         ON public.expenses;
DROP POLICY IF EXISTS "Admins can view expenses"                ON public.expenses;

CREATE POLICY "Users can view their own expenses"
  ON public.expenses FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert their own expenses"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own expenses"
  ON public.expenses FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own expenses or admins"
  ON public.expenses FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
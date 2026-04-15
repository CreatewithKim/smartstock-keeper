
-- =============================================
-- Remove all anon policies from business tables
-- =============================================

-- excess_sales
DROP POLICY IF EXISTS "Anon can read excess_sales for sync" ON public.excess_sales;
DROP POLICY IF EXISTS "Anyone can sync excess_sales" ON public.excess_sales;
DROP POLICY IF EXISTS "Anyone can update synced excess_sales" ON public.excess_sales;

-- expenses
DROP POLICY IF EXISTS "Anon can read expenses for sync" ON public.expenses;
DROP POLICY IF EXISTS "Anyone can sync expenses" ON public.expenses;
DROP POLICY IF EXISTS "Anyone can update synced expenses" ON public.expenses;

-- products
DROP POLICY IF EXISTS "Anon can read products for sync" ON public.products;
DROP POLICY IF EXISTS "Anyone can sync products" ON public.products;
DROP POLICY IF EXISTS "Anyone can update synced products" ON public.products;

-- products_out
DROP POLICY IF EXISTS "Anon can read products_out for sync" ON public.products_out;
DROP POLICY IF EXISTS "Anyone can sync products_out" ON public.products_out;
DROP POLICY IF EXISTS "Anyone can update synced products_out" ON public.products_out;

-- sales
DROP POLICY IF EXISTS "Anon can read sales for sync" ON public.sales;
DROP POLICY IF EXISTS "Anyone can sync sales" ON public.sales;
DROP POLICY IF EXISTS "Anyone can update synced sales" ON public.sales;

-- stock_intakes
DROP POLICY IF EXISTS "Anon can read stock_intakes for sync" ON public.stock_intakes;
DROP POLICY IF EXISTS "Anyone can sync stock_intakes" ON public.stock_intakes;
DROP POLICY IF EXISTS "Anyone can update synced stock_intakes" ON public.stock_intakes;

-- profiles: restrict public read to authenticated only
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- =============================================
-- Add authenticated-only policies
-- =============================================

-- excess_sales
CREATE POLICY "Authenticated users can read excess_sales"
  ON public.excess_sales FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert excess_sales"
  ON public.excess_sales FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update excess_sales"
  ON public.excess_sales FOR UPDATE TO authenticated
  USING (true);

-- expenses
CREATE POLICY "Authenticated users can read expenses"
  ON public.expenses FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert expenses"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update expenses"
  ON public.expenses FOR UPDATE TO authenticated
  USING (true);

-- products
CREATE POLICY "Authenticated users can read products"
  ON public.products FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
  ON public.products FOR UPDATE TO authenticated
  USING (true);

-- products_out
CREATE POLICY "Authenticated users can read products_out"
  ON public.products_out FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert products_out"
  ON public.products_out FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update products_out"
  ON public.products_out FOR UPDATE TO authenticated
  USING (true);

-- sales
CREATE POLICY "Authenticated users can read sales"
  ON public.sales FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sales"
  ON public.sales FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update sales"
  ON public.sales FOR UPDATE TO authenticated
  USING (true);

-- stock_intakes
CREATE POLICY "Authenticated users can read stock_intakes"
  ON public.stock_intakes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert stock_intakes"
  ON public.stock_intakes FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update stock_intakes"
  ON public.stock_intakes FOR UPDATE TO authenticated
  USING (true);

-- profiles: authenticated only
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

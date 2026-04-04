
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Products table
CREATE TABLE public.products (
  id BIGSERIAL PRIMARY KEY,
  local_id INTEGER,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  quantity_kg NUMERIC NOT NULL DEFAULT 0,
  selling_price NUMERIC NOT NULL DEFAULT 0,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  initial_stock NUMERIC NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Sales table
CREATE TABLE public.sales (
  id BIGSERIAL PRIMARY KEY,
  local_id INTEGER,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Stock intakes table
CREATE TABLE public.stock_intakes (
  id BIGSERIAL PRIMARY KEY,
  local_id INTEGER,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  vendor_name TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_intakes ENABLE ROW LEVEL SECURITY;

-- Excess sales table
CREATE TABLE public.excess_sales (
  id BIGSERIAL PRIMARY KEY,
  local_id INTEGER,
  amount NUMERIC NOT NULL DEFAULT 0,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.excess_sales ENABLE ROW LEVEL SECURITY;

-- Products out table
CREATE TABLE public.products_out (
  id BIGSERIAL PRIMARY KEY,
  local_id INTEGER,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  destination TEXT NOT NULL DEFAULT '',
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products_out ENABLE ROW LEVEL SECURITY;

-- Expenses table
CREATE TABLE public.expenses (
  id BIGSERIAL PRIMARY KEY,
  local_id INTEGER,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can read all data
CREATE POLICY "Admins can view products" ON public.products FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view sales" ON public.sales FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view stock_intakes" ON public.stock_intakes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view excess_sales" ON public.excess_sales FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view products_out" ON public.products_out FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view expenses" ON public.expenses FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Allow anonymous inserts for sync (the main app syncs without auth)
CREATE POLICY "Anyone can sync products" ON public.products FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can sync sales" ON public.sales FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can sync stock_intakes" ON public.stock_intakes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can sync excess_sales" ON public.excess_sales FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can sync products_out" ON public.products_out FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can sync expenses" ON public.expenses FOR INSERT TO anon WITH CHECK (true);

-- Allow anon to upsert (update existing synced records)
CREATE POLICY "Anyone can update synced products" ON public.products FOR UPDATE TO anon USING (true);
CREATE POLICY "Anyone can update synced sales" ON public.sales FOR UPDATE TO anon USING (true);
CREATE POLICY "Anyone can update synced stock_intakes" ON public.stock_intakes FOR UPDATE TO anon USING (true);
CREATE POLICY "Anyone can update synced excess_sales" ON public.excess_sales FOR UPDATE TO anon USING (true);
CREATE POLICY "Anyone can update synced products_out" ON public.products_out FOR UPDATE TO anon USING (true);
CREATE POLICY "Anyone can update synced expenses" ON public.expenses FOR UPDATE TO anon USING (true);

-- Admins can also read user_roles
CREATE POLICY "Admins can view roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Allow anon to read products too (for sync dedup)
CREATE POLICY "Anon can read products for sync" ON public.products FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can read sales for sync" ON public.sales FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can read stock_intakes for sync" ON public.stock_intakes FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can read excess_sales for sync" ON public.excess_sales FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can read products_out for sync" ON public.products_out FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can read expenses for sync" ON public.expenses FOR SELECT TO anon USING (true);

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

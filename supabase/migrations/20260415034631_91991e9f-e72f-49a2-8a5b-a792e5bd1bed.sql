
-- Add admin-only DELETE policies to all business tables

CREATE POLICY "Only admins can delete excess_sales"
  ON public.excess_sales FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete expenses"
  ON public.expenses FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete products"
  ON public.products FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete products_out"
  ON public.products_out FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete sales"
  ON public.sales FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete stock_intakes"
  ON public.stock_intakes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

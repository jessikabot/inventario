-- =====================================================================
--  SISTEMA DE INVENTARIO Y VENTAS  -  PASO 1: CREAR LA BASE DE DATOS
--
--  Cómo usar este archivo:
--    1. En Supabase abre "SQL Editor" -> "New query".
--    2. Copia TODO este archivo y pégalo ahí.
--    3. Presiona el botón verde "Run".
--    4. Debe terminar con "Success. No rows returned".
--
--  Puedes ejecutarlo más de una vez sin problema.
--  Este script también crea la carpeta de fotos ("product-images").
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
--  1. TABLAS
-- ---------------------------------------------------------------------

-- Usuarios del sistema (cada usuario de Authentication tiene un perfil)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text not null default '',
  role        text not null default 'consulta' check (role in ('admin','vendedor','consulta')),
  active      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Categorías (el código se usa para armar el ID de cada producto)
create table if not exists public.categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) > 0),
  code         text not null check (code ~ '^[A-Z0-9]{2,6}$'),
  next_number  integer not null default 1,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references public.profiles(id)
);
create unique index if not exists categories_name_uq on public.categories (lower(name));
create unique index if not exists categories_code_uq on public.categories (code);

-- Productos
create table if not exists public.products (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  category_id         uuid not null references public.categories(id),
  title               text not null check (length(trim(title)) > 0),
  link                text,
  description         text,
  stock               integer not null default 0 check (stock >= 0),
  min_stock           integer not null default 0 check (min_stock >= 0),
  unit                text not null default 'unidad' check (unit in ('unidad','par','set')),
  label               text,
  price               numeric(12,2) not null default 0 check (price >= 0),
  notes               text,
  active              boolean not null default true,
  primary_image_path  text,
  stock_status        text generated always as (
                        case when stock <= 0 then 'sin_stock'
                             when stock <= min_stock then 'bajo'
                             else 'ok' end
                      ) stored,
  created_at          timestamptz not null default now(),
  created_by          uuid not null references public.profiles(id),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references public.profiles(id)
);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_creator_idx  on public.products (created_by);
create index if not exists products_status_idx   on public.products (stock_status);

-- Ventas (cabecera)
create table if not exists public.sales (
  id              uuid primary key default gen_random_uuid(),
  sale_number     bigint generated always as identity unique,
  status          text not null default 'completada' check (status in ('completada','anulada')),
  payment_method  text not null check (payment_method in ('efectivo','qr','tarjeta','otro')),
  subtotal        numeric(12,2) not null default 0,
  discount_total  numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  created_by      uuid not null references public.profiles(id),
  cancelled_at    timestamptz,
  cancelled_by    uuid references public.profiles(id),
  cancel_reason   text
);
create index if not exists sales_created_idx on public.sales (created_at);
create index if not exists sales_user_idx    on public.sales (created_by);

-- Detalle de cada venta (guarda una copia del código, nombre y precio del momento)
create table if not exists public.sale_items (
  id             uuid primary key default gen_random_uuid(),
  sale_id        uuid not null references public.sales(id),
  product_id     uuid not null references public.products(id),
  category_id    uuid references public.categories(id),
  product_code   text not null,
  product_title  text not null,
  quantity       integer not null check (quantity > 0),
  unit_price     numeric(12,2) not null check (unit_price >= 0),
  discount       numeric(12,2) not null default 0 check (discount >= 0),
  line_total     numeric(12,2) not null
);
create index if not exists sale_items_sale_idx    on public.sale_items (sale_id);
create index if not exists sale_items_product_idx on public.sale_items (product_id);

-- Historial de movimientos de inventario
create table if not exists public.inventory_movements (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id),
  type          text not null check (type in ('inicial','ingreso','venta','anulacion','ajuste')),
  quantity      integer not null,            -- con signo: + entra, - sale
  stock_before  integer not null,
  stock_after   integer not null,
  sale_id       uuid references public.sales(id),
  note          text,
  created_at    timestamptz not null default now(),
  created_by    uuid not null references public.profiles(id)
);
create index if not exists movements_product_idx on public.inventory_movements (product_id, created_at desc);
create index if not exists movements_created_idx on public.inventory_movements (created_at desc);
create index if not exists movements_user_idx    on public.inventory_movements (created_by);

-- Imágenes de productos
create table if not exists public.product_images (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  storage_path  text not null,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references public.profiles(id)
);
create index if not exists product_images_product_idx on public.product_images (product_id);
create unique index if not exists product_images_one_primary on public.product_images (product_id) where is_primary;

-- Configuración general (una sola fila)
create table if not exists public.app_settings (
  id                 integer primary key default 1 check (id = 1),
  business_name      text not null default 'Mi tienda',
  currency           text not null default 'Bs',
  default_min_stock  integer not null default 3 check (default_min_stock >= 0)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
--  2. FUNCIONES AUXILIARES DE PERMISOS
-- ---------------------------------------------------------------------

-- Rol del usuario actual (vacío si está desactivado o no ha iniciado sesión)
create or replace function public.app_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active = true
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid() and active = true), false)
$$;

-- ¿Puede el usuario actual editar este producto? (admin: todos; vendedor: solo los suyos)
create or replace function public.can_edit_product(p_product_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_product_id is null then false
    when public.app_role() = 'admin' then true
    when public.app_role() = 'vendedor' then exists (
      select 1 from public.products where id = p_product_id and created_by = auth.uid())
    else false end
$$;

-- Convierte texto a uuid sin fallar si el texto no es válido
create or replace function public.safe_uuid(p_text text)
returns uuid language plpgsql immutable as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------------
--  3. PROTECCIONES AUTOMÁTICAS (triggers)
-- ---------------------------------------------------------------------

-- Categorías: arma el código, protege el contador y el código
create or replace function public.trg_categories_before()
returns trigger language plpgsql set search_path = public as $$
declare
  v_internal boolean := coalesce(current_setting('app.internal', true), '') = '1';
  v_base text;
begin
  new.name := trim(new.name);
  if tg_op = 'INSERT' then
    if new.code is null or trim(new.code) = '' then
      v_base := upper(regexp_replace(
                  translate(lower(new.name), 'áéíóúüñàèìòù', 'aeiouunaeiou'),
                  '[^a-z0-9]', '', 'g'));
      new.code := left(v_base, 5);
    else
      new.code := upper(trim(new.code));
    end if;
    if not v_internal then new.next_number := 1; end if;
  else
    new.code := upper(trim(new.code));
    if not v_internal then
      new.next_number := old.next_number;
      if new.code <> old.code and exists (select 1 from public.products where category_id = old.id) then
        raise exception 'No se puede cambiar el código de una categoría que ya tiene productos.';
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists categories_before on public.categories;
create trigger categories_before before insert or update on public.categories
  for each row execute function public.trg_categories_before();

-- Productos: nadie puede cambiar el stock, el ID ni el creador "a mano"
create or replace function public.trg_products_before_update()
returns trigger language plpgsql set search_path = public as $$
declare
  v_internal boolean := coalesce(current_setting('app.internal', true), '') = '1';
begin
  if auth.uid() is not null and not v_internal then
    if new.stock <> old.stock then
      raise exception 'El stock solo cambia con ingresos, ventas, anulaciones o ajustes.';
    end if;
    if new.active <> old.active and not public.is_admin() then
      raise exception 'Solo el administrador puede activar o desactivar productos.';
    end if;
    new.code               := old.code;
    new.created_by         := old.created_by;
    new.created_at         := old.created_at;
    new.primary_image_path := old.primary_image_path;
    new.updated_by         := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists products_before_update on public.products;
create trigger products_before_update before update on public.products
  for each row execute function public.trg_products_before_update();

-- Perfiles: solo el administrador cambia rol/estado; siempre debe quedar un admin activo
create or replace function public.trg_profiles_before_update()
returns trigger language plpgsql set search_path = public as $$
declare
  v_internal boolean := coalesce(current_setting('app.internal', true), '') = '1';
begin
  if auth.uid() is not null and not v_internal and not public.is_admin() then
    new.role   := old.role;
    new.active := old.active;
    new.email  := old.email;
  end if;
  if old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active) then
    if not exists (select 1 from public.profiles where role = 'admin' and active and id <> old.id) then
      raise exception 'Debe existir al menos un administrador activo.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profiles_before_update on public.profiles;
create trigger profiles_before_update before update on public.profiles
  for each row execute function public.trg_profiles_before_update();

-- Al desactivar un usuario, también se bloquea su inicio de sesión
create or replace function public.trg_profiles_sync_ban()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  update auth.users
     set banned_until = case when new.active then null else now() + interval '100 years' end
   where id = new.id;
  return null;
end $$;
drop trigger if exists profiles_sync_ban on public.profiles;
create trigger profiles_sync_ban after update of active on public.profiles
  for each row when (old.active is distinct from new.active)
  execute function public.trg_profiles_sync_ban();

-- Cuando se crea un usuario en Authentication, se crea su perfil (desactivado por seguridad)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, active)
  values (new.id, coalesce(new.email, ''),
          coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'consulta', false)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Imágenes: mantiene la imagen principal de cada producto
create or replace function public.trg_product_images_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pid uuid := coalesce(new.product_id, old.product_id);
begin
  perform set_config('app.internal', '1', true);
  perform 1 from public.products where id = v_pid for update;
  if not found then return null; end if;
  if not exists (select 1 from public.product_images where product_id = v_pid and is_primary) then
    update public.product_images set is_primary = true
     where id = (select id from public.product_images where product_id = v_pid order by created_at, id limit 1);
  end if;
  update public.products
     set primary_image_path = (select storage_path from public.product_images
                                where product_id = v_pid and is_primary limit 1)
   where id = v_pid;
  return null;
end $$;
drop trigger if exists product_images_after on public.product_images;
create trigger product_images_after after insert or delete on public.product_images
  for each row execute function public.trg_product_images_after();

-- ---------------------------------------------------------------------
--  4. OPERACIONES DEL NEGOCIO (stock, ventas, usuarios)
--     Toda modificación de stock pasa por aquí, así nunca hay inconsistencias.
-- ---------------------------------------------------------------------

-- Crear producto (genera el ID automático y el movimiento inicial)
create or replace function public.create_product(
  p_category_id uuid, p_title text, p_link text, p_description text,
  p_quantity integer, p_unit text, p_label text, p_price numeric,
  p_notes text, p_min_stock integer
) returns public.products
language plpgsql security definer set search_path = public as $$
declare
  v_cat  public.categories;
  v_num  integer;
  v_qty  integer := coalesce(p_quantity, 0);
  v_prod public.products;
begin
  if public.app_role() not in ('admin','vendedor') then
    raise exception 'No tienes permiso para registrar productos.';
  end if;
  if v_qty < 0 then raise exception 'La cantidad inicial no puede ser negativa.'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'El título es obligatorio.'; end if;

  perform set_config('app.internal', '1', true);

  select * into v_cat from public.categories where id = p_category_id for update;
  if not found or not v_cat.active then
    raise exception 'La categoría no existe o está desactivada.';
  end if;

  v_num := v_cat.next_number;
  update public.categories set next_number = next_number + 1 where id = v_cat.id;

  insert into public.products
    (code, category_id, title, link, description, stock, min_stock, unit, label, price, notes, created_by)
  values
    (v_cat.code || '-' || case when v_num > 9999 then v_num::text else lpad(v_num::text, 4, '0') end,
     v_cat.id, trim(p_title), nullif(trim(p_link), ''), nullif(trim(p_description), ''),
     v_qty, coalesce(p_min_stock, 0), coalesce(p_unit, 'unidad'), nullif(trim(p_label), ''),
     coalesce(p_price, 0), nullif(trim(p_notes), ''), auth.uid())
  returning * into v_prod;

  if v_qty > 0 then
    insert into public.inventory_movements
      (product_id, type, quantity, stock_before, stock_after, note, created_by)
    values (v_prod.id, 'inicial', v_qty, 0, v_qty, 'Stock inicial al registrar el producto', auth.uid());
  end if;

  return v_prod;
end $$;

-- Ingreso de mercadería (+)
create or replace function public.add_stock(p_product_id uuid, p_quantity integer, p_note text)
returns public.inventory_movements
language plpgsql security definer set search_path = public as $$
declare
  v_prod public.products;
  v_mov  public.inventory_movements;
begin
  if public.app_role() not in ('admin','vendedor') then
    raise exception 'No tienes permiso para registrar ingresos.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero.';
  end if;
  perform set_config('app.internal', '1', true);
  select * into v_prod from public.products where id = p_product_id for update;
  if not found then raise exception 'El producto no existe.'; end if;
  if not v_prod.active then raise exception 'El producto está desactivado.'; end if;

  update public.products set stock = stock + p_quantity, updated_by = auth.uid() where id = v_prod.id;

  insert into public.inventory_movements
    (product_id, type, quantity, stock_before, stock_after, note, created_by)
  values (v_prod.id, 'ingreso', p_quantity, v_prod.stock, v_prod.stock + p_quantity,
          nullif(trim(p_note), ''), auth.uid())
  returning * into v_mov;
  return v_mov;
end $$;

-- Ajuste de inventario (solo administrador, motivo obligatorio)
create or replace function public.adjust_stock(p_product_id uuid, p_new_stock integer, p_reason text)
returns public.inventory_movements
language plpgsql security definer set search_path = public as $$
declare
  v_prod public.products;
  v_mov  public.inventory_movements;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede ajustar el inventario.';
  end if;
  if p_new_stock is null or p_new_stock < 0 then
    raise exception 'El nuevo stock no puede ser negativo.';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Escribe el motivo del ajuste.';
  end if;
  perform set_config('app.internal', '1', true);
  select * into v_prod from public.products where id = p_product_id for update;
  if not found then raise exception 'El producto no existe.'; end if;
  if v_prod.stock = p_new_stock then
    raise exception 'El nuevo stock es igual al stock actual.';
  end if;

  update public.products set stock = p_new_stock, updated_by = auth.uid() where id = v_prod.id;

  insert into public.inventory_movements
    (product_id, type, quantity, stock_before, stock_after, note, created_by)
  values (v_prod.id, 'ajuste', p_new_stock - v_prod.stock, v_prod.stock, p_new_stock,
          trim(p_reason), auth.uid())
  returning * into v_mov;
  return v_mov;
end $$;

-- Registrar una venta (descuenta el stock y deja el historial)
-- p_items: [{"product_id": "...", "quantity": 2, "discount": 0}, ...]
create or replace function public.create_sale(p_payment_method text, p_notes text, p_items jsonb)
returns public.sales
language plpgsql security definer set search_path = public as $$
declare
  v_sale     public.sales;
  v_item     jsonb;
  v_prod     public.products;
  v_qty      integer;
  v_disc     numeric(12,2);
  v_line     numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
begin
  if public.app_role() not in ('admin','vendedor') then
    raise exception 'No tienes permiso para registrar ventas.';
  end if;
  if p_payment_method is null or p_payment_method not in ('efectivo','qr','tarjeta','otro') then
    raise exception 'Elige un método de pago válido.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Agrega al menos un producto a la venta.';
  end if;
  if (select count(distinct t.value ->> 'product_id') from jsonb_array_elements(p_items) as t(value))
       <> jsonb_array_length(p_items) then
    raise exception 'Hay productos repetidos en la venta.';
  end if;

  perform set_config('app.internal', '1', true);

  insert into public.sales (payment_method, notes, created_by)
  values (p_payment_method, nullif(trim(p_notes), ''), auth.uid())
  returning * into v_sale;

  for v_item in
    select t.value from jsonb_array_elements(p_items) as t(value) order by t.value ->> 'product_id'
  loop
    v_qty  := (v_item ->> 'quantity')::integer;
    v_disc := coalesce((v_item ->> 'discount')::numeric, 0);

    select * into v_prod from public.products
     where id = (v_item ->> 'product_id')::uuid for update;
    if not found then raise exception 'Uno de los productos ya no existe.'; end if;
    if not v_prod.active then
      raise exception 'El producto % está desactivado.', v_prod.code;
    end if;
    if v_qty is null or v_qty <= 0 then
      raise exception 'La cantidad de % debe ser mayor a cero.', v_prod.code;
    end if;
    if v_prod.stock < v_qty then
      raise exception 'Stock insuficiente de % (%): hay % y pediste %.',
        v_prod.code, v_prod.title, v_prod.stock, v_qty;
    end if;
    v_line := v_qty * v_prod.price;
    if v_disc < 0 or v_disc > v_line then
      raise exception 'El descuento de % no puede ser mayor al subtotal.', v_prod.code;
    end if;

    insert into public.sale_items
      (sale_id, product_id, category_id, product_code, product_title, quantity, unit_price, discount, line_total)
    values
      (v_sale.id, v_prod.id, v_prod.category_id, v_prod.code, v_prod.title, v_qty, v_prod.price, v_disc, v_line - v_disc);

    update public.products set stock = stock - v_qty where id = v_prod.id;

    insert into public.inventory_movements
      (product_id, type, quantity, stock_before, stock_after, sale_id, note, created_by)
    values (v_prod.id, 'venta', -v_qty, v_prod.stock, v_prod.stock - v_qty, v_sale.id,
            'Venta #' || lpad(v_sale.sale_number::text, 6, '0'), auth.uid());

    v_subtotal := v_subtotal + v_line;
    v_discount := v_discount + v_disc;
  end loop;

  update public.sales
     set subtotal = v_subtotal, discount_total = v_discount, total = v_subtotal - v_discount
   where id = v_sale.id
  returning * into v_sale;
  return v_sale;
end $$;

-- Anular una venta (solo administrador): devuelve el stock y conserva todo el historial
create or replace function public.cancel_sale(p_sale_id uuid, p_reason text)
returns public.sales
language plpgsql security definer set search_path = public as $$
declare
  v_sale public.sales;
  v_item record;
  v_prod public.products;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede anular ventas.';
  end if;
  perform set_config('app.internal', '1', true);

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then raise exception 'La venta no existe.'; end if;
  if v_sale.status = 'anulada' then raise exception 'Esta venta ya fue anulada.'; end if;

  for v_item in
    select product_id, quantity from public.sale_items where sale_id = v_sale.id order by product_id
  loop
    select * into v_prod from public.products where id = v_item.product_id for update;
    update public.products set stock = stock + v_item.quantity where id = v_prod.id;
    insert into public.inventory_movements
      (product_id, type, quantity, stock_before, stock_after, sale_id, note, created_by)
    values (v_prod.id, 'anulacion', v_item.quantity, v_prod.stock, v_prod.stock + v_item.quantity,
            v_sale.id, 'Anulación de la venta #' || lpad(v_sale.sale_number::text, 6, '0'), auth.uid());
  end loop;

  update public.sales
     set status = 'anulada', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = nullif(trim(p_reason), '')
   where id = v_sale.id
  returning * into v_sale;
  return v_sale;
end $$;

-- Definir la imagen principal de un producto
create or replace function public.set_primary_image(p_image_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_img public.product_images;
begin
  select * into v_img from public.product_images where id = p_image_id;
  if not found then raise exception 'La imagen no existe.'; end if;
  if not public.can_edit_product(v_img.product_id) then
    raise exception 'No tienes permiso para editar este producto.';
  end if;
  perform set_config('app.internal', '1', true);
  perform 1 from public.products where id = v_img.product_id for update;
  update public.product_images set is_primary = false where product_id = v_img.product_id and is_primary;
  update public.product_images set is_primary = true where id = v_img.id;
  update public.products set primary_image_path = v_img.storage_path where id = v_img.product_id;
end $$;

-- Crear un usuario desde dentro del sistema (solo administrador)
create or replace function public.admin_create_user(
  p_email text, p_password text, p_full_name text, p_role text
) returns uuid
language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  v_id    uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede crear usuarios.';
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El correo no es válido.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'La contraseña debe tener al menos 6 caracteres.';
  end if;
  if p_role is null or p_role not in ('admin','vendedor','consulta') then
    raise exception 'El rol no es válido.';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Escribe el nombre completo.';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Ya existe un usuario con ese correo.';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', trim(p_full_name)),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', v_id::text, now(), now(), now()
  );

  perform set_config('app.internal', '1', true);
  update public.profiles
     set full_name = trim(p_full_name), email = v_email, role = p_role, active = true
   where id = v_id;
  return v_id;
end $$;

-- Cambiar la contraseña de un usuario (solo administrador)
create or replace function public.admin_set_password(p_user_id uuid, p_password text)
returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede cambiar contraseñas.';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'La contraseña debe tener al menos 6 caracteres.';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user_id;
  if not found then raise exception 'El usuario no existe.'; end if;
end $$;

-- ---------------------------------------------------------------------
--  5. VISTAS Y REPORTES
-- ---------------------------------------------------------------------

-- Categorías con su cantidad de productos activos
create or replace view public.v_category_counts with (security_invoker = true) as
select c.*, (select count(*) from public.products p where p.category_id = c.id and p.active) as product_count
  from public.categories c;

-- Una fila por cada producto vendido (base de todos los reportes de ventas)
create or replace view public.v_sale_lines with (security_invoker = true) as
select s.id as sale_id, s.sale_number, s.created_at,
       (s.created_at at time zone 'America/La_Paz')::date as sale_day,
       s.status, s.payment_method, s.created_by as user_id, u.full_name as user_name,
       i.product_id, i.product_code, i.product_title, i.category_id, c.name as category_name,
       i.quantity, i.unit_price, i.discount, i.line_total
  from public.sales s
  join public.sale_items i on i.sale_id = s.id
  join public.profiles u on u.id = s.created_by
  left join public.categories c on c.id = i.category_id;

-- Reporte de ventas agrupado: day | month | user | category | product | payment | all
create or replace function public.rpt_sales_group(
  p_group text, p_from date, p_to date,
  p_user uuid default null, p_category uuid default null, p_product uuid default null,
  p_status text default 'completada'
) returns table (group_key text, group_label text, sales_count bigint, units bigint, total numeric)
language sql stable security invoker set search_path = public as $$
  select
    case p_group
      when 'day'      then l.sale_day::text
      when 'month'    then to_char(l.sale_day, 'YYYY-MM')
      when 'user'     then l.user_id::text
      when 'category' then coalesce(l.category_id::text, '-')
      when 'product'  then l.product_id::text
      when 'payment'  then l.payment_method
      else 'all' end as group_key,
    max(case p_group
      when 'day'      then l.sale_day::text
      when 'month'    then to_char(l.sale_day, 'YYYY-MM')
      when 'user'     then l.user_name
      when 'category' then coalesce(l.category_name, 'Sin categoría')
      when 'product'  then l.product_code || '  ' || l.product_title
      when 'payment'  then l.payment_method
      else 'Total' end) as group_label,
    count(distinct l.sale_id) as sales_count,
    coalesce(sum(l.quantity), 0)::bigint as units,
    coalesce(sum(l.line_total), 0) as total
  from public.v_sale_lines l
  where l.sale_day between p_from and p_to
    and (p_user is null or l.user_id = p_user)
    and (p_category is null or l.category_id = p_category)
    and (p_product is null or l.product_id = p_product)
    and (p_status = 'todas' or l.status = p_status)
  group by 1
  order by 1
$$;

-- ---------------------------------------------------------------------
--  6. SEGURIDAD (quién puede ver y modificar cada cosa)
-- ---------------------------------------------------------------------

alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.products            enable row level security;
alter table public.product_images      enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.sales               enable row level security;
alter table public.sale_items          enable row level security;
alter table public.app_settings        enable row level security;

-- profiles
drop policy if exists profiles_select       on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
drop policy if exists profiles_update_self  on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.app_role()) is not null);
create policy profiles_update_admin on public.profiles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- categories
drop policy if exists categories_select on public.categories;
drop policy if exists categories_insert on public.categories;
drop policy if exists categories_update on public.categories;
create policy categories_select on public.categories for select to authenticated
  using ((select public.app_role()) is not null);
create policy categories_insert on public.categories for insert to authenticated
  with check ((select public.is_admin()));
create policy categories_update on public.categories for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- products (se crean solo con create_product; el stock solo cambia con las funciones)
drop policy if exists products_select on public.products;
drop policy if exists products_update on public.products;
create policy products_select on public.products for select to authenticated
  using ((select public.app_role()) is not null);
create policy products_update on public.products for update to authenticated
  using ((select public.app_role()) = 'admin'
         or ((select public.app_role()) = 'vendedor' and created_by = (select auth.uid())))
  with check ((select public.app_role()) = 'admin'
         or ((select public.app_role()) = 'vendedor' and created_by = (select auth.uid())));

-- product_images
drop policy if exists product_images_select on public.product_images;
drop policy if exists product_images_insert on public.product_images;
drop policy if exists product_images_delete on public.product_images;
create policy product_images_select on public.product_images for select to authenticated
  using ((select public.app_role()) is not null);
create policy product_images_insert on public.product_images for insert to authenticated
  with check (public.can_edit_product(product_id));
create policy product_images_delete on public.product_images for delete to authenticated
  using (public.can_edit_product(product_id));

-- inventory_movements (solo lectura; se crean con las funciones)
drop policy if exists movements_select on public.inventory_movements;
create policy movements_select on public.inventory_movements for select to authenticated
  using ((select public.app_role()) = 'admin'
         or ((select public.app_role()) = 'vendedor' and created_by = (select auth.uid())));

-- sales y sale_items (solo lectura; se crean con las funciones)
drop policy if exists sales_select      on public.sales;
drop policy if exists sale_items_select on public.sale_items;
create policy sales_select on public.sales for select to authenticated
  using ((select public.app_role()) = 'admin'
         or ((select public.app_role()) = 'vendedor' and created_by = (select auth.uid())));
create policy sale_items_select on public.sale_items for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));

-- app_settings
drop policy if exists settings_select on public.app_settings;
drop policy if exists settings_update on public.app_settings;
create policy settings_select on public.app_settings for select to authenticated
  using ((select public.app_role()) is not null);
create policy settings_update on public.app_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Permisos de acceso a las tablas (las políticas de arriba son las que realmente deciden)
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- ---------------------------------------------------------------------
--  7. CARPETA DE FOTOS (Storage)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "product_images_read"   on storage.objects;
drop policy if exists "product_images_insert" on storage.objects;
drop policy if exists "product_images_delete" on storage.objects;

create policy "product_images_read" on storage.objects for select
  using (bucket_id = 'product-images');
create policy "product_images_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images'
              and public.can_edit_product(public.safe_uuid((storage.foldername(name))[1])));
create policy "product_images_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images'
         and public.can_edit_product(public.safe_uuid((storage.foldername(name))[1])));

-- Listo.

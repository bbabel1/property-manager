-- Allow unit images to be stored without a Buildium image link
alter table public.unit_images
  alter column buildium_image_id drop not null;

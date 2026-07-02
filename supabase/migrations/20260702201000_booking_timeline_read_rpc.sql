-- Customer-safe booking timeline reads for the future Supabase cutover.
-- The raw status_events table remains protected by RLS; this RPC returns only
-- public event history for owners, claimed customers, or guests with a claim
-- token. It intentionally hides created_by and payment/SMS/ledger internals.

create index if not exists status_events_booking_created_asc_idx
  on public.status_events (booking_id, created_at asc);

create or replace function public.get_booking_timeline(
  booking_id_input uuid,
  claim_token_hash_input text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_booking_access(booking_id_input, claim_token_hash_input);

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'booking_id', e.booking_id,
        'event_type', e.event_type,
        'status', e.status,
        'display_group', case
          when e.event_type like 'owner_%' then 'owner'
          when e.event_type like 'customer_%' then 'customer'
          when e.event_type like 'booking_%' then 'booking'
          else 'system'
        end,
        'created_at', e.created_at
      )
      order by e.created_at asc
    )
    from public.status_events e
    where e.booking_id = booking_id_input
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_booking_timeline(uuid, text) from public;
grant execute on function public.get_booking_timeline(uuid, text) to anon, authenticated;

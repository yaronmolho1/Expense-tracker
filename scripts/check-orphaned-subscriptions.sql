-- Check for transactions tagged as subscriptions but not linked to a subscription record
SELECT
  t.id,
  t.deal_date,
  b.display_name as business,
  t.charged_amount_ils,
  t.transaction_type,
  t.subscription_id,
  CASE
    WHEN t.subscription_id IS NULL THEN 'ORPHANED - No subscription_id'
    WHEN s.id IS NULL THEN 'ORPHANED - subscription_id points to non-existent subscription'
    ELSE 'LINKED - OK'
  END as status
FROM transactions t
LEFT JOIN businesses b ON t.business_id = b.id
LEFT JOIN subscriptions s ON t.subscription_id = s.id
WHERE t.transaction_type = 'subscription'
ORDER BY t.deal_date DESC
LIMIT 50;

-- Count summary
SELECT
  CASE
    WHEN subscription_id IS NULL THEN 'No subscription_id'
    ELSE 'Has subscription_id'
  END as link_status,
  COUNT(*) as count
FROM transactions
WHERE transaction_type = 'subscription'
GROUP BY link_status;

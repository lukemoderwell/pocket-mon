-- Balance rush attack power and add accuracy to all existing moves.
-- Rush power clamped to [1.2, 1.75]. Accuracy added per effect type.

UPDATE monsters
SET moves = (
  SELECT jsonb_agg(
    jsonb_set(
      jsonb_set(
        elem,
        '{power}',
        -- Clamp rush power to max 1.75, min 1.2
        CASE
          WHEN elem->>'effect' = 'rush' THEN
            to_jsonb(LEAST(1.75, GREATEST(1.2, (elem->>'power')::numeric)))
          ELSE elem->'power'
        END
      ),
      '{accuracy}',
      -- Add accuracy based on effect type (midpoint of each range)
      CASE elem->>'effect'
        WHEN 'strike' THEN to_jsonb(0.93)
        WHEN 'guard'  THEN to_jsonb(1.0)
        WHEN 'rush'   THEN to_jsonb(0.7)
        WHEN 'drain'  THEN to_jsonb(0.88)
        WHEN 'stun'   THEN to_jsonb(0.8)
        ELSE to_jsonb(1.0)
      END
    )
  FROM jsonb_array_elements(moves) AS elem
  )
)
WHERE moves IS NOT NULL
  AND jsonb_array_length(moves) > 0;

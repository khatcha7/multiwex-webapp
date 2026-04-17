'use client';

import { useRef, useMemo, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { generateSlotsForActivity, toMinutes, fromMinutes } from '@/lib/hours';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function hashRoom(id) {
  const h = String(id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return ['k7-record', 'k7-studio', 'k7-dancefloor'][h % 3];
}

const K7_SUB_LABELS = {
  'k7-record': 'Record',
  'k7-studio': 'Studio',
  'k7-dancefloor': 'Dancefloor',
};

const TOTAL_HOURS = 24;
const ROW_HEIGHT = 64; // 4em

/* ------------------------------------------------------------------ */
/*  Slot status helpers                                                */
/* ------------------------------------------------------------------ */

/** Return booking items that overlap a given slot on a given lane. */
function bookingsForSlot(bookings, laneId, slotStart, slotEnd) {
  const sM = toMinutes(slotStart);
  const eM = toMinutes(slotEnd);
  const matches = [];
  for (const b of bookings) {
    if (!b.items) continue;
    for (const item of b.items) {
      if (item.laneId !== laneId) continue;
      const iS = toMinutes(item.start);
      const iE = toMinutes(item.end || fromMinutes(iS + (item.duration || 0)));
      if (iS < eM && iE > sM) {
        matches.push({ booking: b, item });
      }
    }
  }
  return matches;
}

/** Return blocks that cover a slot on a given lane. */
function blocksForSlot(blocks, laneId, slotStart, slotEnd) {
  const sM = toMinutes(slotStart);
  const eM = toMinutes(slotEnd);
  return blocks.filter((bl) => {
    if (bl.laneId && bl.laneId !== laneId) return false;
    const bS = toMinutes(bl.start);
    const bE = toMinutes(bl.end);
    return bS < eM && bE > sM;
  });
}

/** Compute CSS class for a slot based on occupancy + blocks. */
function slotClass(players, maxPlayers, isBlocked) {
  if (isBlocked) return 'cal-slot-blocked';
  if (players >= maxPlayers) return 'cal-slot-full';
  if (players > 0) return 'cal-slot-partial';
  return 'cal-slot-free';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TransposedDayView({
  date,
  lanes = [],
  bookings = [],
  blocks = [],
  pxPerHour = 120,
  hours,
  multiSel = [],
  highlightIds = new Set(),
  onClick,
  onRightClick,
  onHoverEnter,
  onHoverLeave,
  onBlockHour,
  k7Open = false,
  onToggleK7,
}) {
  const scrollRef = useRef(null);
  const headerRef = useRef(null);
  const sidebarRef = useRef(null);

  /* ---------- scroll sync ---------- */
  useEffect(() => {
    const body = scrollRef.current;
    if (!body) return;
    const onScroll = () => {
      if (headerRef.current) headerRef.current.scrollLeft = body.scrollLeft;
      if (sidebarRef.current) sidebarRef.current.scrollTop = body.scrollTop;
    };
    body.addEventListener('scroll', onScroll, { passive: true });
    return () => body.removeEventListener('scroll', onScroll);
  }, []);

  /* ---------- derived values ---------- */
  const openMin = hours ? toMinutes(hours.open) : 0;
  const closeMin = hours ? toMinutes(hours.close) : 1440;
  const totalWidth = TOTAL_HOURS * pxPerHour;

  /* ---------- batch-block merging ---------- */
  const mergedBlocksByLane = useMemo(() => {
    const map = {}; // laneId -> [{start, end, label, batchId}]
    const batchMap = {}; // batchId -> aggregated block

    for (const bl of blocks) {
      if (bl.batchId) {
        const key = `${bl.laneId || '_all_'}::${bl.batchId}`;
        if (!batchMap[key]) {
          batchMap[key] = { ...bl, _startM: toMinutes(bl.start), _endM: toMinutes(bl.end) };
        } else {
          const existing = batchMap[key];
          const sM = toMinutes(bl.start);
          const eM = toMinutes(bl.end);
          if (sM < existing._startM) { existing._startM = sM; existing.start = bl.start; }
          if (eM > existing._endM) { existing._endM = eM; existing.end = bl.end; }
          if (bl.label) existing.label = bl.label;
        }
      } else {
        const lid = bl.laneId || '_all_';
        if (!map[lid]) map[lid] = [];
        map[lid].push(bl);
      }
    }

    for (const merged of Object.values(batchMap)) {
      const lid = merged.laneId || '_all_';
      if (!map[lid]) map[lid] = [];
      map[lid].push(merged);
    }

    return map;
  }, [blocks]);

  /* ---------- generate all slots per lane ---------- */
  const laneSlots = useMemo(() => {
    const result = {};
    for (const lane of lanes) {
      result[lane.laneId] = generateSlotsForActivity(
        { ...lane, bookable: true, selectable: true },
        date,
        { fullDay: true }
      );
    }
    return result;
  }, [lanes, date]);

  /* ---------- K7 sub-row helpers ---------- */
  const isK7 = useCallback(
    (lane) => lane.name?.toLowerCase().includes('karaok') || lane.id?.toLowerCase?.().includes('k7'),
    []
  );

  /* ---------- shift+wheel → horizontal scroll ---------- */
  const handleWheel = useCallback((e) => {
    if (e.shiftKey && scrollRef.current) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY || e.deltaX;
    }
  }, []);

  /* ---------- multiSel lookup ---------- */
  const multiSelSet = useMemo(() => {
    const s = new Set();
    for (const ms of multiSel) {
      s.add(`${ms.laneId}::${ms.slot?.start}`);
    }
    return s;
  }, [multiSel]);

  /* ---------- Determine which lanes are K7 ---------- */
  const k7Lanes = useMemo(() => lanes.filter(isK7), [lanes, isK7]);
  const nonK7Lanes = useMemo(() => lanes.filter((l) => !isK7(l)), [lanes, isK7]);

  /* ---------- build ordered row list ---------- */
  const rows = useMemo(() => {
    const result = [];
    for (const lane of lanes) {
      if (isK7(lane)) {
        // K7 lane — always one entry; sub-rows handled in render
        if (!result.find((r) => r.type === 'k7')) {
          result.push({ type: 'k7', lane, subLanes: k7Lanes });
        }
      } else {
        result.push({ type: 'normal', lane });
      }
    }
    return result;
  }, [lanes, isK7, k7Lanes]);

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  /** Render a single slot button */
  function renderSlot(lane, slot, rowTop, rowHeight, isOutside) {
    const slotStartM = toMinutes(slot.start);
    const slotEndM = toMinutes(slot.end);
    const duration = slotEndM - slotStartM;

    // Position & size
    const left = (slotStartM / 60) * pxPerHour;
    const width = (duration / 60) * pxPerHour;

    // Check blocks (use merged)
    const laneBlocks = [
      ...(mergedBlocksByLane[lane.laneId] || []),
      ...(mergedBlocksByLane['_all_'] || []),
    ];
    const matchingBlocks = blocksForSlot(laneBlocks, lane.laneId, slot.start, slot.end);
    const isBlocked = matchingBlocks.length > 0;
    const blockLabel = matchingBlocks.find((b) => b.label)?.label || '';

    // Bookings
    const matchingBookings = bookingsForSlot(bookings, lane.laneId, slot.start, slot.end);
    let players = 0;
    let isHighlighted = false;
    for (const { booking, item } of matchingBookings) {
      players += item.players || item.count || 1;
      if (highlightIds.has?.(booking.id)) isHighlighted = true;
    }

    const statusCls = slotClass(players, lane.maxPlayers || 1, isBlocked);
    const isSelected = multiSelSet.has(`${lane.laneId}::${slot.start}`);

    const classes = [
      statusCls,
      isSelected ? 'cal-slot-selected' : '',
      isHighlighted ? 'cal-slot-highlight' : '',
    ].filter(Boolean).join(' ');

    return (
      <button
        key={`${lane.laneId}-${slot.start}`}
        className={classes}
        style={{
          position: 'absolute',
          left,
          top: rowTop,
          width: Math.max(width - 1, 2),
          height: rowHeight - 1,
          border: '1px solid #000',
          cursor: 'pointer',
          opacity: isOutside ? 0.5 : 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1px 2px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          fontSize: 12,
          color: statusCls === 'cal-slot-full' || statusCls === 'cal-slot-blocked' ? '#fff' : '#000',
          lineHeight: 1.2,
          zIndex: isSelected ? 5 : 1,
        }}
        onClick={(e) => onClick?.(lane.laneId, lane, slot, e)}
        onContextMenu={(e) => {
          e.preventDefault();
          onRightClick?.(e, lane.laneId, lane, slot);
        }}
        onMouseEnter={() => onHoverEnter?.(lane.laneId, lane, slot)}
        onMouseLeave={() => onHoverLeave?.()}
        title={`${lane.name} — ${slot.start}-${slot.end}`}
      >
        {isBlocked ? (
          <span style={{ fontWeight: 700, fontSize: 12, textAlign: 'center', color: 'inherit' }}>
            {blockLabel || 'Bloqué'}
          </span>
        ) : (
          <>
            <span className="cal-time" style={{ fontSize: 12, color: 'inherit' }}>
              {slot.start}
            </span>
            <span className="cal-players" style={{ fontSize: 12, color: 'inherit' }}>
              {players}/{lane.maxPlayers || '?'}
            </span>
          </>
        )}
      </button>
    );
  }

  /** Render merged batch-block overlay */
  function renderMergedBlocks(lane, rowTop, rowHeight) {
    const laneBlocks = mergedBlocksByLane[lane.laneId] || [];
    const allBlocks = mergedBlocksByLane['_all_'] || [];
    const combined = [...laneBlocks, ...allBlocks].filter((b) => b.batchId);

    // Deduplicate by batchId
    const seen = new Set();
    const unique = [];
    for (const b of combined) {
      const key = `${b.batchId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(b);
    }

    return unique.map((bl) => {
      const sM = bl._startM ?? toMinutes(bl.start);
      const eM = bl._endM ?? toMinutes(bl.end);
      const left = (sM / 60) * pxPerHour;
      const width = ((eM - sM) / 60) * pxPerHour;

      return (
        <div
          key={`batch-${lane.laneId}-${bl.batchId}`}
          className="cal-slot-blocked"
          style={{
            position: 'absolute',
            left,
            top: rowTop,
            width: Math.max(width - 1, 2),
            height: rowHeight - 1,
            border: '2px solid #CC003C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 4,
            pointerEvents: 'none',
            fontSize: 13,
            fontWeight: 700,
            color: '#fff',
          }}
        >
          {bl.label || 'Bloqué'}
        </div>
      );
    });
  }

  /** Render all slots for a lane (normal row) */
  function renderLaneSlots(lane, rowTop, rowHeight) {
    const slots = laneSlots[lane.laneId] || [];
    return (
      <>
        {slots.map((slot) => {
          const sM = toMinutes(slot.start);
          const isOutside = sM < openMin || sM >= closeMin;
          return renderSlot(lane, slot, rowTop, rowHeight, isOutside);
        })}
        {renderMergedBlocks(lane, rowTop, rowHeight)}
      </>
    );
  }

  /* ---- Compute total grid height ---- */
  let gridHeight = 0;
  const rowMeta = []; // [{rowTop, rowHeight, row}]
  for (const row of rows) {
    if (row.type === 'k7') {
      const h = k7Open ? ROW_HEIGHT * 3 : ROW_HEIGHT;
      rowMeta.push({ rowTop: gridHeight, rowHeight: h, row });
      gridHeight += h;
    } else {
      rowMeta.push({ rowTop: gridHeight, rowHeight: ROW_HEIGHT, row });
      gridHeight += ROW_HEIGHT;
    }
  }

  return (
    <div
      style={{ position: 'relative', width: '100%', overflow: 'hidden' }}
    >
      {/* Time header */}
      <div style={{ display: 'flex' }}>
        {/* Sticky label spacer */}
        <div style={{ minWidth: 160, maxWidth: 160, flexShrink: 0 }} />
        <div
          ref={headerRef}
          style={{
            overflowX: 'hidden',
            flex: 1,
            height: 28,
          }}
        >
          <div style={{ position: 'relative', width: totalWidth, height: 28 }}>
            {Array.from({ length: TOTAL_HOURS }, (_, i) => {
              const isOpen = i * 60 >= openMin && i * 60 < closeMin;
              return (
                <button
                  key={i}
                  onClick={() => onBlockHour?.(fromMinutes(i * 60))}
                  style={{
                    position: 'absolute',
                    left: i * pxPerHour,
                    width: pxPerHour,
                    height: 28,
                    border: '1px solid #000',
                    borderBottom: '2px solid #000',
                    background: isOpen ? '#f8f8f8' : '#e0e0e0',
                    opacity: isOpen ? 1 : 0.5,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    boxSizing: 'border-box',
                  }}
                >
                  {i}h
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Body: sticky row headers + scrollable grid */}
      <div style={{ display: 'flex', maxHeight: 'calc(100vh - 200px)', overflow: 'hidden' }}>
        {/* Row headers — sticky left, vertical scroll synced */}
        <div
          style={{
            minWidth: 160,
            maxWidth: 160,
            flexShrink: 0,
            overflowY: 'hidden',
            position: 'relative',
            borderRight: '2px solid #000',
            background: '#fff',
            zIndex: 10,
          }}
          ref={sidebarRef}
        >
          <div style={{ position: 'relative', height: gridHeight }}>
            {rowMeta.map(({ rowTop, rowHeight, row }, idx) => {
              if (row.type === 'k7') {
                const firstK7 = row.subLanes[0] || row.lane;
                return (
                  <div
                    key={`header-k7`}
                    style={{
                      position: 'absolute',
                      top: rowTop,
                      height: rowHeight,
                      width: '100%',
                      borderBottom: '1px solid #000',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }}
                    onClick={() => onToggleK7?.()}
                    title={k7Open ? 'Réduire K7 Karaoké' : 'Développer K7 Karaoké'}
                  >
                    {k7Open ? (
                      // Expanded: 3 sub-row headers
                      ['k7-record', 'k7-studio', 'k7-dancefloor'].map((subKey, si) => (
                        <div
                          key={subKey}
                          style={{
                            height: ROW_HEIGHT,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '0 6px',
                            borderBottom: si < 2 ? '1px solid #999' : 'none',
                            background: si % 2 === 0 ? '#faf5ff' : '#f5f0ff',
                            fontSize: 12,
                            fontWeight: 500,
                            color: '#000',
                          }}
                        >
                          {firstK7.logo && (
                            <Image
                              src={firstK7.logo}
                              alt=""
                              width={20}
                              height={20}
                              style={{ borderRadius: 4 }}
                            />
                          )}
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {K7_SUB_LABELS[subKey]}
                          </span>
                        </div>
                      ))
                    ) : (
                      // Collapsed: activity name with expand hint
                      <div
                        style={{
                          height: ROW_HEIGHT,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '0 6px',
                          background: '#faf5ff',
                        }}
                      >
                        {firstK7.logo && (
                          <Image
                            src={firstK7.logo}
                            alt=""
                            width={24}
                            height={24}
                            style={{ borderRadius: 4 }}
                          />
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            K7 Karaoké
                          </span>
                          <span style={{ fontSize: 10, color: '#666' }}>
                            ▶ 3 salles
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              // Normal lane header
              const { lane } = row;
              return (
                <div
                  key={`header-${lane.laneId}`}
                  style={{
                    position: 'absolute',
                    top: rowTop,
                    height: rowHeight,
                    width: '100%',
                    borderBottom: '1px solid #000',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '0 6px',
                    background: idx % 2 === 0 ? '#fff' : '#f9f9f9',
                    overflow: 'hidden',
                  }}
                >
                  {lane.logo && (
                    <Image
                      src={lane.logo}
                      alt=""
                      width={28}
                      height={28}
                      style={{ borderRadius: 4, flexShrink: 0 }}
                    />
                  )}
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: '#000',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={lane.name}
                  >
                    {lane.name || lane.laneLabel || lane.laneId}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable grid area */}
        <div
          ref={scrollRef}
          onWheel={handleWheel}
          style={{
            overflow: 'auto',
            position: 'relative',
            flex: 1,
          }}
        >
          <div style={{ position: 'relative', width: totalWidth, height: gridHeight, minHeight: gridHeight }}>
            {/* Row backgrounds / separators */}
            {rowMeta.map(({ rowTop, rowHeight, row }, idx) => (
              <div
                key={`bg-${idx}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: rowTop,
                  width: totalWidth,
                  height: rowHeight,
                  borderBottom: '1px solid #000',
                  background: idx % 2 === 0 ? '#fff' : '#f9f9f9',
                  boxSizing: 'border-box',
                }}
              />
            ))}

            {/* Hour vertical gridlines */}
            {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
              <div
                key={`vline-${i}`}
                style={{
                  position: 'absolute',
                  left: i * pxPerHour,
                  top: 0,
                  width: 1,
                  height: gridHeight,
                  background: i * 60 === openMin || i * 60 === closeMin ? '#000' : '#ddd',
                  zIndex: 0,
                }}
              />
            ))}

            {/* Opening hours background tint */}
            <div
              style={{
                position: 'absolute',
                left: (openMin / 60) * pxPerHour,
                top: 0,
                width: ((closeMin - openMin) / 60) * pxPerHour,
                height: gridHeight,
                background: 'rgba(200, 240, 200, 0.12)',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            />

            {/* Slots per row */}
            {rowMeta.map(({ rowTop, rowHeight, row }) => {
              if (row.type === 'k7') {
                if (k7Open) {
                  // 3 expanded sub-rows
                  return ['k7-record', 'k7-studio', 'k7-dancefloor'].map((subKey, si) => {
                    const subLane = row.subLanes.find(
                      (l) => l.roomId === subKey || hashRoom(l.roomId || l.laneId) === subKey
                    ) || row.subLanes[si] || row.lane;
                    return (
                      <div key={`k7-sub-${subKey}`}>
                        {renderLaneSlots(subLane, rowTop + si * ROW_HEIGHT, ROW_HEIGHT)}
                      </div>
                    );
                  });
                }

                // Collapsed K7: 3 mini-rows inside one ROW_HEIGHT
                const miniH = ROW_HEIGHT / 3;
                return ['k7-record', 'k7-studio', 'k7-dancefloor'].map((subKey, si) => {
                  const subLane = row.subLanes.find(
                    (l) => l.roomId === subKey || hashRoom(l.roomId || l.laneId) === subKey
                  ) || row.subLanes[si] || row.lane;
                  const slots = laneSlots[subLane.laneId] || [];
                  return slots.map((slot) => {
                    const sM = toMinutes(slot.start);
                    const eM = toMinutes(slot.end);
                    const duration = eM - sM;
                    const left = (sM / 60) * pxPerHour;
                    const width = (duration / 60) * pxPerHour;
                    const isOutside = sM < openMin || sM >= closeMin;

                    const laneBlocks = [
                      ...(mergedBlocksByLane[subLane.laneId] || []),
                      ...(mergedBlocksByLane['_all_'] || []),
                    ];
                    const matchingBlocks = blocksForSlot(laneBlocks, subLane.laneId, slot.start, slot.end);
                    const isBlocked = matchingBlocks.length > 0;

                    const matchingBookings = bookingsForSlot(bookings, subLane.laneId, slot.start, slot.end);
                    let players = 0;
                    let isHighlighted = false;
                    for (const { booking, item } of matchingBookings) {
                      players += item.players || item.count || 1;
                      if (highlightIds.has?.(booking.id)) isHighlighted = true;
                    }

                    const statusCls = slotClass(players, subLane.maxPlayers || 1, isBlocked);
                    const isSelected = multiSelSet.has(`${subLane.laneId}::${slot.start}`);

                    const classes = [
                      statusCls,
                      isSelected ? 'cal-slot-selected' : '',
                      isHighlighted ? 'cal-slot-highlight' : '',
                    ].filter(Boolean).join(' ');

                    return (
                      <button
                        key={`k7-mini-${subKey}-${slot.start}`}
                        className={classes}
                        style={{
                          position: 'absolute',
                          left,
                          top: rowTop + si * miniH,
                          width: Math.max(width - 1, 2),
                          height: Math.max(miniH - 1, 8),
                          border: '1px solid #000',
                          cursor: 'pointer',
                          opacity: isOutside ? 0.5 : 1,
                          fontSize: 10,
                          color: statusCls === 'cal-slot-full' || statusCls === 'cal-slot-blocked' ? '#fff' : '#000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          boxSizing: 'border-box',
                          overflow: 'hidden',
                          lineHeight: 1,
                          zIndex: isSelected ? 5 : 1,
                        }}
                        onClick={(e) => onClick?.(subLane.laneId, subLane, slot, e)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          onRightClick?.(e, subLane.laneId, subLane, slot);
                        }}
                        onMouseEnter={() => onHoverEnter?.(subLane.laneId, subLane, slot)}
                        onMouseLeave={() => onHoverLeave?.()}
                        title={`${K7_SUB_LABELS[subKey]} — ${slot.start}`}
                      >
                        {isBlocked ? '' : `${players}`}
                      </button>
                    );
                  });
                });
              }

              // Normal lane
              return (
                <div key={`slots-${row.lane.laneId}`}>
                  {renderLaneSlots(row.lane, rowTop, rowHeight)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const { searchAll, search, executeQuery } = require('../utils/db')

// In-memory schedule registry: workshopId -> { startTimer, endTimer }
const workshopIdToTimers = new Map()

function clearTimersForWorkshop(workshopId) {
  const timers = workshopIdToTimers.get(workshopId)
  if (timers) {
    if (timers.startTimer) clearTimeout(timers.startTimer)
    if (timers.endTimer) clearTimeout(timers.endTimer)
    workshopIdToTimers.delete(workshopId)
  }
}

async function enforceLockoutNow(workshop) {
  try {
    // Terminate any active VNC sessions tied to instances in this workshop
    await executeQuery(
      `DELETE FROM sessions WHERE instance_id IN (
         SELECT id FROM instances WHERE workshop_id = ?
       )`,
      [workshop.id]
    )
    console.log(`Lock enforced for workshop ${workshop.name}: active sessions terminated`)
  } catch (err) {
    console.error('Error enforcing lockout for workshop', workshop.id, err)
  }
}

function scheduleTimersForWorkshop(workshop) {
  clearTimersForWorkshop(workshop.id)

  const timers = { startTimer: null, endTimer: null }

  const now = Date.now()
  const start = workshop.lockout_start ? new Date(workshop.lockout_start).getTime() : null
  const end = workshop.lockout_end ? new Date(workshop.lockout_end).getTime() : null

  const isValidStart = typeof start === 'number' && !isNaN(start)
  const isValidEnd = typeof end === 'number' && !isNaN(end)

  console.log(`Scheduling lockout for workshop ${workshop.name}:`, {
    now: new Date(now).toISOString(),
    start: start ? new Date(start).toISOString() : null,
    end: end ? new Date(end).toISOString() : null,
    isValidStart,
    isValidEnd
  })

  // Allowed window is [start, end). We lock outside this window.
  // Cases:
  // - Both start and end valid
  if (isValidStart && isValidEnd) {
    if (now < start) {
      // Pre-start: lock now, schedule unlock at start and lock at end
      console.log(`Workshop ${workshop.name}: Pre-start phase - locking now, scheduling unlock at start`)
      enforceLockoutNow(workshop)
      timers.startTimer = setTimeout(() => {
        console.log(`Unlocking at start for workshop ${workshop.name}`)
      }, Math.max(0, start - now))
      timers.endTimer = setTimeout(() => {
        console.log(`Locking at end for workshop ${workshop.name}`)
        enforceLockoutNow(workshop)
        clearTimersForWorkshop(workshop.id)
      }, Math.max(0, end - now))
    } else if (now >= start && now < end) {
      // During window: schedule lock at end
      console.log(`Workshop ${workshop.name}: During window - scheduling lock at end`)
      timers.endTimer = setTimeout(() => {
        console.log(`Locking at end for workshop ${workshop.name}`)
        enforceLockoutNow(workshop)
        clearTimersForWorkshop(workshop.id)
      }, Math.max(0, end - now))
    } else {
      // After end: lock now
      console.log(`Workshop ${workshop.name}: After end - locking now`)
      enforceLockoutNow(workshop)
    }
  } else if (isValidStart && !isValidEnd) {
    // Only start defined: lock until start, then unlock
    if (now < start) {
      console.log(`Workshop ${workshop.name}: Only start defined - locking until start`)
      enforceLockoutNow(workshop)
      timers.startTimer = setTimeout(() => {
        console.log(`Unlocking at start for workshop ${workshop.name}`)
        clearTimersForWorkshop(workshop.id)
      }, Math.max(0, start - now))
    } else {
      // After start: allowed, no timers
      console.log(`Workshop ${workshop.name}: Only start defined - after start, no timers needed`)
    }
  } else if (!isValidStart && isValidEnd) {
    // Only end defined: allowed until end, then lock
    if (now < end) {
      console.log(`Workshop ${workshop.name}: Only end defined - scheduling lock at end`)
      timers.endTimer = setTimeout(() => {
        console.log(`Locking at end for workshop ${workshop.name}`)
        enforceLockoutNow(workshop)
        clearTimersForWorkshop(workshop.id)
      }, Math.max(0, end - now))
    } else {
      console.log(`Workshop ${workshop.name}: Only end defined - after end, locking now`)
      enforceLockoutNow(workshop)
    }
  } else {
    // No lockout window
    console.log(`Workshop ${workshop.name}: No lockout window defined`)
  }

  workshopIdToTimers.set(workshop.id, timers)
}

async function initializeLockoutScheduler() {
  try {
    const workshops = await searchAll('workshops', [], [], { orderBy: 'name' })
    for (const workshop of workshops) {
      if (workshop.lockout_start && workshop.lockout_end) {
        scheduleTimersForWorkshop(workshop)
      }
    }
    console.log(`Lockout scheduler initialized for ${workshopIdToTimers.size} workshop(s) with lockout windows`)
  } catch (err) {
    console.error('Failed to initialize lockout scheduler:', err)
  }
}

async function rescheduleForWorkshop(workshopId) {
  try {
    const workshop = await search('workshops', 'id', workshopId)
    if (!workshop) return
    scheduleTimersForWorkshop(workshop)
    console.log(`Lockout schedule updated for workshop ${workshop.name}`)
  } catch (err) {
    console.error('Failed to reschedule lockout for workshop', workshopId, err)
  }
}

module.exports = {
  initializeLockoutScheduler,
  rescheduleForWorkshop,
  // Expose a simple view of schedules
  getSchedules: () => {
    const entries = []
    for (const [workshopId, timers] of workshopIdToTimers.entries()) {
      entries.push({ workshopId, hasStartTimer: !!timers.startTimer, hasEndTimer: !!timers.endTimer })
    }
    return entries
  },
}



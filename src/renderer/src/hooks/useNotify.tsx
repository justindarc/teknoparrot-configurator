import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import Snackbar from "@mui/material/Snackbar"
import Alert from "@mui/material/Alert"

type Severity = "success" | "error" | "info"
type NotifyFn = (message: string, severity?: Severity) => void

const NotifyContext = createContext<NotifyFn>(() => undefined)

/** Provides a global `notify()` and renders the snackbar it drives. */
export function NotificationProvider({ children }: { children: ReactNode }): JSX.Element {
  const [notice, setNotice] = useState<{ message: string; severity: Severity } | null>(null)

  const notify = useCallback<NotifyFn>((message, severity = "success") => {
    setNotice({ message, severity })
  }, [])

  const value = useMemo(() => notify, [notify])

  return (
    <NotifyContext.Provider value={value}>
      {children}
      <Snackbar
        open={notice !== null}
        autoHideDuration={4000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        {notice ? (
          <Alert severity={notice.severity} variant="filled" onClose={() => setNotice(null)}>
            {notice.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </NotifyContext.Provider>
  )
}

export function useNotify(): NotifyFn {
  return useContext(NotifyContext)
}

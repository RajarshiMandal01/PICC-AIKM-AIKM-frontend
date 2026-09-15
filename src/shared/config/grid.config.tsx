import { type GridColDef } from "@mui/x-data-grid";
import { Pencil, Plus, ShieldOff,Trash } from "lucide-react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

type GridActionHandlers<T = any> = {
  onAdd?: (row: T) => void;
  onEdit?: (row: T, gridType?: string) => void;
  onDisable?: (row: T, gridType?: string) => void;
  onDelete?: (row: T, gridType?: string) => void;
  getStatus?: (row: T) => string | undefined;
  gridType?: string;
};

export const RegistrationRequestColumnGrid: GridColDef[] = [
  { field: 'acc', headerName: 'ACCOUNT', width: 300 },
  { field: 'date', headerName: 'DATE', width: 200 },
  { field: 'status', headerName: 'STATUS', width: 100 },
  { field: 'country', headerName: 'COUNTRY', width: 100 },
]

export const getActionColumn = <T = any>(
  handlers: GridActionHandlers<T>
): GridColDef => ({
  field: 'actions',
  headerName: 'Actions',
  width: 120,
  sortable: false,
  filterable: false,
  disableColumnMenu: true,
  renderCell: (params) => {
    const status = handlers.getStatus?.(params.row);
    return (
      <div className="flex space-x-10">
        {handlers.onEdit && !params.row.isAdd && (
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={() => handlers.onEdit?.(params.row, handlers.gridType)}
            >
              <Pencil fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {handlers.onAdd && params.row.isAdd && (
          <Tooltip title="Add">
            <IconButton
              size="small"
              onClick={() => handlers.onAdd?.(params.row)}
            >
              <Plus fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {handlers.onDisable && status == 'ACTIVE' && (
          <Tooltip title="Disable">
            <IconButton
              size="small"
              onClick={() => handlers.onDisable?.(params.row, handlers.gridType)}
            >
              <ShieldOff fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {handlers.onDelete && (
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => handlers.onDelete?.(params.row)}
            >
              <Trash fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </div>
    )
  },
});

import {
    forwardRef,
    useImperativeHandle,
    useState,
} from "react";
import {
    DataGrid,
    type GridColDef,
    type GridRowId,
    type GridRowSelectionModel,
} from "@mui/x-data-grid";

export type NNPGridProps = {
    columns: GridColDef[];
    rows: any[];
    loading?: boolean;
    isColumselectionDisabled?: boolean;
    showCheckbox?: boolean;
    onSelectionChange?: (selectedRows: any[]) => void;
    getRowId?: (row: any) => GridRowId; // ✅ Add this

};
export type NNPGridRef = {
    getSelectedRows: () => any[];
};

const NNPGrid = forwardRef<NNPGridRef, NNPGridProps>(
    (
        {
            columns,
            rows,
            loading = false,
            isColumselectionDisabled = false,
            showCheckbox = false,
            onSelectionChange,
            getRowId
        },
        ref
    ) => {
        const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>({
            type: 'include',
            ids: new Set(),
        });

        // ✅ Helper: filter rows based on selected IDs
        const formatRowId = (rowSelection: GridRowSelectionModel) => {
            const selectedIds = Array.from(rowSelection.ids ?? []);
            const selected = rows.filter((row) => {
                const rowKey = getRowId ? getRowId(row) : row.id;
                return selectedIds.includes(rowKey as GridRowId);
            });
            return selected
            // return rows.filter(row => selectedIds.includes(row.id));
        };

        // ✅ Expose selected rows to parent
        useImperativeHandle(ref, () => ({
            getSelectedRows: () => formatRowId(rowSelectionModel),
        }));

        return (
            <div style={{ height: "100%", width: "100%" }}>
                <DataGrid
                    rows={rows}
                    columns={columns}
                    loading={loading}
                    checkboxSelection={showCheckbox}
                    disableRowSelectionOnClick={isColumselectionDisabled}
                    rowHeight={35}
                    pageSizeOptions={[5, 10, 20]}
                    getRowClassName={(params) =>
                        params.indexRelativeToCurrentPage % 2 === 0
                            ? 'even-row'
                            : 'odd-row'
                    }
                    sx={{
                        '& .even-row': {
                            backgroundColor: 'var(--grid-even-row-color)', // light gray or white
                        },
                        '& .odd-row': {
                            backgroundColor: 'var(--grid-odd-row-color)',
                        },
                        "& .MuiDataGrid-columnHeader": {
                            backgroundColor: "var(--grid-header-color) !important",
                            color: "var(--grid-header-text-color)",
                        },
                    }}
                    getRowId={(row) => getRowId ? getRowId(row) : row.id} // Use the provided getRowId prop
                    initialState={{
                        pagination: { paginationModel: { pageSize: 10, page: 0 } },
                    }}
                    onRowSelectionModelChange={(newModel) => {
                        setRowSelectionModel(newModel);

                        if ((newModel.ids?.size ?? 0) === 0) {
                            onSelectionChange?.([]);
                        } else {
                            onSelectionChange?.(formatRowId(newModel));
                        }
                    }}
                    rowSelectionModel={rowSelectionModel}

                />
            </div>
        );
    }
);

export default NNPGrid;

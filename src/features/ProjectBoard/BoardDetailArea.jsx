import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Grid,
  TextField,
  Typography,
  IconButton,
  Divider,
  Card,
  Autocomplete,
} from "@mui/material";
import AirlineSeatReclineNormalOutlinedIcon from "@mui/icons-material/AirlineSeatReclineNormalOutlined";
import RemoveCircleOutlineOutlinedIcon from "@mui/icons-material/RemoveCircleOutlineOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { boardDetailStyles } from "@/shared/styles/BoardDetail/BoardDetail";
import BoardCategories from "@/shared/constants/BoardCategories";
import { renderSelect } from "./formUtils";

const generateInitialPurpose = () => ({
  purpose: "",
  rooms: [
    {
      roomName: "",
      isOpen: true,
      areas: [{ area: "", seats: "", areaSize: "" }],
    },
  ],
});

const getZoneOptions = (purpose, roomName) => {
  return (
    BoardCategories.zoneOptionsByPurposeAndRoom?.[purpose]?.[roomName] ||
    BoardCategories.zoneOptionsByPurpose?.[purpose] ||
    BoardCategories.zoneOptions
  );
};

const BoardDetailArea = ({ initialAreaSeatList = [], onChange }) => {
  const [purposeRoomAreaList, setPurposeRoomAreaList] = useState([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && initialAreaSeatList && initialAreaSeatList.length > 0) {
      setPurposeRoomAreaList(initialAreaSeatList);
      setInitialized(true);
    } else if (!initialized && (!initialAreaSeatList || initialAreaSeatList.length === 0)) {
      setPurposeRoomAreaList([generateInitialPurpose()]);
      setInitialized(true);
    }
  }, [initialAreaSeatList, initialized]);

  useEffect(() => {
    if (initialized) {
      onChange?.(purposeRoomAreaList);
    }
  }, [purposeRoomAreaList, initialized]);

  const handlePurposeChange = (idx, value) => {
    const updated = [...purposeRoomAreaList];
    updated[idx].purpose = value;
    setPurposeRoomAreaList(updated);
  };

  const handleRoomNameChange = (purposeIdx, roomIdx, value) => {
    const updated = [...purposeRoomAreaList];
    updated[purposeIdx].rooms[roomIdx].roomName = value;
    setPurposeRoomAreaList(updated);
  };

  const handleAreaChange = (purposeIdx, roomIdx, areaIdx, field, value) => {
    const updated = [...purposeRoomAreaList];
    updated[purposeIdx].rooms[roomIdx].areas[areaIdx][field] =
      field === "seats" || field === "areaSize" ? Number(value) : value;
    setPurposeRoomAreaList(updated);
  };

  const handleAddArea = (purposeIdx, roomIdx) => {
    const updated = [...purposeRoomAreaList];
    updated[purposeIdx].rooms[roomIdx].areas.push({ area: "", seats: "", areaSize: "" });
    setPurposeRoomAreaList(updated);
  };

  const handleRemoveArea = (purposeIdx, roomIdx, areaIdx) => {
    const updated = [...purposeRoomAreaList];
    updated[purposeIdx].rooms[roomIdx].areas.splice(areaIdx, 1);
    setPurposeRoomAreaList(updated);
  };

  const handleAddRoom = (purposeIdx) => {
    const updated = [...purposeRoomAreaList];
    updated[purposeIdx].rooms.push({
      roomName: "",
      isOpen: true,
      areas: [{ area: "", seats: "", areaSize: "" }],
    });
    setPurposeRoomAreaList(updated);
  };

  const handleRemoveRoom = (purposeIdx, roomIdx) => {
    const updated = [...purposeRoomAreaList];
    updated[purposeIdx].rooms.splice(roomIdx, 1);
    setPurposeRoomAreaList(updated);
  };

  const toggleRoomOpen = (purposeIdx, roomIdx) => {
    const updated = [...purposeRoomAreaList];
    updated[purposeIdx].rooms[roomIdx].isOpen = !updated[purposeIdx].rooms[roomIdx].isOpen;
    setPurposeRoomAreaList(updated);
  };

  const handleAddPurpose = () => {
    setPurposeRoomAreaList([...purposeRoomAreaList, generateInitialPurpose()]);
  };

  const handleRemovePurpose = (purposeIdx) => {
    const updated = [...purposeRoomAreaList];
    updated.splice(purposeIdx, 1);
    setPurposeRoomAreaList(updated);
  };

  return (
    <>
      <Typography variant="subtitle2" sx={{ ...boardDetailStyles.subTitle, mb: 2 }}>
        <AirlineSeatReclineNormalOutlinedIcon sx={{ mr: 1 }} />
        用途別・室名ごとのエリア・席数設定
      </Typography>
      <Box sx={boardDetailStyles.section}>
        <Box sx={{ mb: 2 }}>
          <Button variant="outlined" onClick={handleAddPurpose}>
            用途を追加
          </Button>
        </Box>

        {purposeRoomAreaList.map((purposeGroup, purposeIdx) => {
          const currentRoomOptions =
            BoardCategories.roomTypesByPurpose[purposeGroup.purpose] || BoardCategories.roomTypes;

          return (
            <Card key={purposeIdx} sx={{ p: 2, mb: 4, ...boardDetailStyles.card }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                {renderSelect({
                  id: `purpose-${purposeIdx}`,
                  label: "用途",
                  value: purposeGroup.purpose,
                  onChange: (e) => handlePurposeChange(purposeIdx, e.target.value),
                  options: BoardCategories.purposeTypes,
                  sx: boardDetailStyles.textField,
                })}
                <Button onClick={() => handleRemovePurpose(purposeIdx)} color="error" sx={{ ml: 2 }}>
                  削除
                </Button>
              </Box>

              {purposeGroup.rooms.map((room, roomIdx) => {
                const zoneCandidates = getZoneOptions(purposeGroup.purpose, room.roomName);
                return (
                  <Box key={roomIdx} sx={{ mb: 3 }}>
                    <Grid container alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <Grid item xs={4}>
                        <Autocomplete
                          freeSolo
                          options={currentRoomOptions}
                          value={room.roomName}
                          onChange={(e, newValue) =>
                            handleRoomNameChange(purposeIdx, roomIdx, newValue || "")
                          }
                          renderInput={(params) => (
                            <TextField {...params} label="室名" sx={boardDetailStyles.textField} />
                          )}
                        />
                      </Grid>
                    </Grid>

                    {room.isOpen &&
                      room.areas.map((area, areaIdx) => (
                        <Grid container spacing={1} alignItems="center" key={areaIdx} sx={{ mb: 1 }}>
                          <Grid item xs={4}>
                            <Autocomplete
                              freeSolo
                              options={zoneCandidates}
                              value={area.area}
                              onChange={(e, newValue) =>
                                handleAreaChange(purposeIdx, roomIdx, areaIdx, "area", newValue || "")
                              }
                              renderInput={(params) => (
                                <TextField {...params} label="エリア名" sx={boardDetailStyles.textField} />
                              )}
                            />
                          </Grid>
                          <Grid item xs={2}>
                            <TextField
                              label="席数"
                              type="number"
                              value={area.seats}
                              onChange={(e) =>
                                handleAreaChange(purposeIdx, roomIdx, areaIdx, "seats", e.target.value)
                              }
                              fullWidth
                              sx={boardDetailStyles.textField}
                            />
                          </Grid>
                          <Grid item xs={2}>
                            <TextField
                              label="面積（㎡）"
                              type="number"
                              value={area.areaSize}
                              onChange={(e) =>
                                handleAreaChange(purposeIdx, roomIdx, areaIdx, "areaSize", e.target.value)
                              }
                              fullWidth
                              sx={boardDetailStyles.textField}
                            />
                          </Grid>
                          <Grid item xs={1}>
                            <IconButton onClick={() => handleRemoveArea(purposeIdx, roomIdx, areaIdx)} size="small">
                              <RemoveCircleOutlineOutlinedIcon color="error" />
                            </IconButton>
                          </Grid>
                        </Grid>
                      ))}

                    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
                      <Button
                        onClick={() => handleAddArea(purposeIdx, roomIdx)}
                        size="small"
                        variant="outlined"
                        sx={{ mr: 2 }}
                      >
                        エリアを追加
                      </Button>
                      <Button
                        onClick={() => handleRemoveRoom(purposeIdx, roomIdx)}
                        size="small"
                        color="error"
                        variant="outlined"
                      >
                        室名を削除
                      </Button>
                    </Box>
                    <Divider sx={boardDetailStyles.divider} />
                  </Box>
                );
              })}

              <Box sx={{ textAlign: "right" }}>
                <Button variant="outlined" onClick={() => handleAddRoom(purposeIdx)}>
                  室名を追加
                </Button>
              </Box>
            </Card>
          );
        })}
      </Box>
    </>
  );
};

export default BoardDetailArea;
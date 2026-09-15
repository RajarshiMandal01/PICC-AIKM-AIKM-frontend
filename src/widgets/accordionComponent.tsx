import React, { useEffect, useState } from "react";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import IndeterminateCheckBoxOutlinedIcon from "@mui/icons-material/IndeterminateCheckBoxOutlined";
import AddBoxOutlinedIcon from "@mui/icons-material/AddBoxOutlined";
import { customAccordionOption } from "../shared/types/customAccordionOption";

// Reusable Top-Level Accordion Component
const AccordionComponent = React.memo(
  ({
    isExpanded,
    accordionOption,
    setExpand,
    children,
  }: {
    isExpanded: boolean;
    accordionOption: customAccordionOption;
    setExpand?: (accordionOption: customAccordionOption) => void;
    children: React.ReactNode;
  }) => {
    const [expanded, setExpanded] = useState(true);

    const onToggle = () => {
      if (!expanded && setExpand) {
        setExpand(accordionOption);
      }
      setExpanded(!expanded);
    };

    useEffect(() => {
      setExpanded(isExpanded);
    }, []);

    return (
      <>
        <Accordion
          expanded={expanded}
          onChange={onToggle}
          className="nnp-border shadow-none rounded-none before:hidden"
          sx={{
            boxShadow: 'none',
            '&:last-of-type': {
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
            },
            '&:first-of-type': {
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
            },

          }}
        >
          <AccordionSummary
        // className={`
        //   group
        //   !bg-[#888888]
        //   !text-[#ffffcc]
        //   nnp-header
        //   hover:!bg-[var(--component-color-tertiary)] 
        //   hover:!text-[var(--text-color-primary)]
        // `}
className={`
      group
      ${accordionOption?.style?.headerBg || '!bg-[#888888]'}
      ${accordionOption?.style?.headerColor || '!text-[#ffffcc]'}
      
      nnp-header
      hover:!bg-[var(--component-color-tertiary)] 
      hover:!text-[var(--text-color-primary)]
    `}

            sx={{
              '&.Mui-expanded': {
                borderBottom: '1px solid var(--border-color) !important',
              },
            }}

            expandIcon={
              expanded ? (
                <IndeterminateCheckBoxOutlinedIcon
                  className={`${accordionOption?.style?.headerColor || '!text-[#ffffcc]'}
            group-hover:!text-[var(--text-color-primary)]
          `}
                />
              ) : (
                <AddBoxOutlinedIcon
                  className={`${accordionOption?.style?.headerColor || '!text-[#ffffcc]'}
            group-hover:!text-[var(--text-color-primary)]
          `}
                />
              )
            }
          >
            {accordionOption?.title}
          </AccordionSummary>

          <AccordionDetails className="body-font !p-0">
            {children}
          </AccordionDetails>
        </Accordion>
      </>
    );
  }
);

export default AccordionComponent;

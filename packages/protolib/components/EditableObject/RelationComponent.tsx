import { Stack } from "@my/ui";
import { FormElement } from ".";
import { getElement } from "./Element";
import { List } from '@tamagui/lucide-icons';
import { useEffect, useState } from "react";
import { API } from 'protobase'
import { SelectList } from "../../components/SelectList";

export const RelationComponent = ({ ele, elementDef, icon, path, data, setData, setFormData, mode, customFields, inArray, arrayName, getFormData, URLTransform }) => {
  const [instances, setInstances] = useState([])
  const model = elementDef?.relation?.model
  if (!model) return <p>Model not found in relation</p>

  useEffect(() => {
    const fetch = async () => {
      let modelKeys = (await API.get("/api/core/v1/objects/" + model + "Model")).data?.keys ?? {}
      let id = Object.keys(modelKeys).find(key => {
        let foundModifierId = modelKeys[key]?.modifiers?.find(m => m?.name === "id")
        return foundModifierId ? true : false
      }) ?? "id" // fallback to key "id"
      let _instances = (await API.get("/api/v1/" + model)).data?.items?.map(obj => obj[id]).filter(v => v)
      console.log("id: ", id, _instances)
      setInstances(_instances)
    }
    fetch()
  }, [])

  return <FormElement ele={ele} icon={icon} inArray={inArray}>
    <SelectList
      title="Model name"
      placeholder="Select related object"
      elements={instances}
      value={data?.[ele?.name]?.["relationId"] ?? "default"}
      setValue={(v) => setFormData(ele.name, { relationId: v })}
    />
  </FormElement>
}
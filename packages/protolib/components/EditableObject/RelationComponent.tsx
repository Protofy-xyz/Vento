import { FormElement } from ".";
import { useEffect, useState } from "react";
import { API } from 'protobase'
import { SelectList } from "../../components/SelectList";
import { useRouter } from "solito/navigation";

export const RelationComponent = ({ ele, elementDef, icon, path, data, setData, setFormData, mode, customFields, inArray, arrayName, getFormData, URLTransform }) => {
  const [instances, setInstances] = useState({})
  const model = elementDef?.relation?.model
  const displayField = elementDef?.relation?.displayField
  const router = useRouter()
  if (!model) return <p>Model not found in relation</p>

  useEffect(() => {
    const fetch = async () => {
      // get model id
      let modelKeys = (await API.get("/api/core/v1/objects/" + model + "Model")).data?.keys ?? {}
      let id = Object.keys(modelKeys).find(key => {
        let foundModifierId = modelKeys[key]?.modifiers?.find(m => m?.name === "id")
        return foundModifierId ? true : false
      }) ?? "id" // fallback to key "id"

      // instances is a map where "display field" or "id"
      // are set as keys and are related to the original 
      // instance value as id
      let _instancesList = (await API.get("/api/v1/" + model)).data?.items
      let _instances = {}
      _instancesList.forEach(obj => {
        let key = id
        if (displayField && obj[displayField]) {
          key = obj[displayField]
        }
        _instances[key] = obj[id]
      })

      setInstances(_instances)
    }
    fetch()
  }, [model, displayField])

  return <FormElement ele={ele} icon={icon} inArray={inArray}>
    <SelectList
      title={model}
      placeholder="Select related object"
      elements={[
        ...Object.keys(instances),
        { value: "__manage__", caption: `Manage ${model}` }
      ]}
      value={data?.[ele?.name]?.["relationId"] ?? "default"}
      setValue={(k) => {
        if (k === "__manage__") {
          router.push(`/objects/view?object=${model}Model`)
          return
        }
        setFormData(ele.name, { relationId: instances[k], model, displayField: displayField ?? "id" })
      }}
      f={1}
    />
  </FormElement>
}

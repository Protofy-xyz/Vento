
//@react
reactCard(`
  async function validateKey(apiKey) {
   // return true or false if the key is valid or not
    return true;
  }

  function Widget() {
    return (
          <View className="no-drag">
            <KeySetter
              nameKey={data?.configParams?.nameKey?.defaultValue}
              validate={validateKey}
              onAdd={(key) => {
                settings.set('ai.enabled', true)
              }}
              onRemove={(key) => {
                settings.del('ai.enabled')
              }}
            />
          </View>
    );
  }

`, data.domId)

            